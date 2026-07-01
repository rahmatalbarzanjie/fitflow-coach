import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/whatsapp'

// ── Runtime configuration (environment variables) ─────────────────────────────
//
// This worker is a plain HTTP POST handler. Scheduling is handled entirely by
// an external adapter - Vercel Cron, Linux crontab, PM2, Railway, Coolify, or
// any service that can call an authenticated HTTP endpoint on a schedule.
//
// These env vars let operators tune the worker per deployment without changing
// application code:
//
//   WA_QUEUE_BUDGET_MS
//     How long (ms) one invocation may run before stopping gracefully.
//     The worker tracks elapsed time internally and stops before this budget
//     expires, so unprocessed rows remain safely in 'processing' status until
//     the recovery sweep picks them up on the next invocation.
//     Default: 55000 (55 seconds) - safe across Vercel Pro, Railway, VPS.
//     Tune up (e.g. 270000) on platforms with long function timeouts.
//
//   WA_QUEUE_BATCH_SIZE
//     Maximum rows claimed per invocation. The budget check may stop the
//     loop earlier than this limit.
//     Default: 10
//
//   WA_QUEUE_RECOVERY_MINUTES
//     Rows stuck in 'processing' beyond this threshold are assumed orphaned
//     from a prior crashed or timed-out invocation and are reset to 'queued'.
//     Must be meaningfully larger than WA_QUEUE_BUDGET_MS to avoid recovering
//     rows from a currently-running parallel invocation.
//     Default: 10 (minutes)

function envInt(key: string, fallback: number): number {
  const v = process.env[key]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const BUDGET_MS                 = envInt('WA_QUEUE_BUDGET_MS',              55_000)
const BATCH_SIZE                = envInt('WA_QUEUE_BATCH_SIZE',             10)
const RECOVERY_THRESHOLD_MINUTES = envInt('WA_QUEUE_RECOVERY_MINUTES',      10)

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_DELAY_MS   = 3_000
const MAX_DELAY_MS   = 8_000
const RETRY_BASE_MS  = 30_000  // 30s after attempt 1, 60s after 2, 90s after 3

// Budget guard: stop the loop when remaining time is too short for another
// delay + Fonnte round-trip. 3s covers the Fonnte call + two DB writes.
const MIN_CYCLE_MS   = MAX_DELAY_MS + 3_000  // 11s worst-case per cycle

const ERR_FONNTE_REJECTED        = 'FONNTE_REJECTED'
const ERR_FONNTE_NETWORK         = 'FONNTE_NETWORK_ERROR'
const ERR_RECOVERED_FROM_TIMEOUT = 'RECOVERED_FROM_TIMEOUT'
const ERR_MAX_ATTEMPTS_REACHED   = 'MAX_ATTEMPTS_REACHED'

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomDelayMs(): number {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function detectUrls(text: string): { contains: boolean; count: number } {
  const matches = text.match(/https?:\/\/\S+/g)
  const count   = matches?.length ?? 0
  return { contains: count > 0, count }
}

async function sendViaFonnte(
  token: string,
  phone: string | null,
  groupId: string | null,
  message: string,
): Promise<{ ok: boolean; providerMessageId?: string; errorCode: string | null; errorMessage: string | null }> {
  try {
    const target = phone ? normalizePhone(phone) : groupId!
    const res    = await fetch('https://api.fonnte.com/send', {
      method:  'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ target, message, countryCode: '62' }),
    })
    const json = await res.json() as { status: boolean; id?: string; reason?: string }
    if (json.status === true) {
      return { ok: true, providerMessageId: json.id ? String(json.id) : undefined, errorCode: null, errorMessage: null }
    }
    return {
      ok:           false,
      errorCode:    ERR_FONNTE_REJECTED,
      errorMessage: json.reason ?? 'Fonnte mengembalikan status false tanpa alasan',
    }
  } catch (err: any) {
    return {
      ok:           false,
      errorCode:    ERR_FONNTE_NETWORK,
      errorMessage: err?.message ?? 'Network error saat memanggil Fonnte API',
    }
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service         = createServiceClient()
  const now             = new Date()
  const invocationStart = Date.now()

  // ── Phase 1: Stuck-processing recovery ──────────────────────────────────
  // Rows in 'processing' beyond RECOVERY_THRESHOLD_MINUTES are assumed
  // orphaned from a prior invocation that crashed or exhausted its budget.
  // Reset to 'queued' before the SELECT so they can be included in this batch.
  const recoveryBefore = new Date(now.getTime() - RECOVERY_THRESHOLD_MINUTES * 60 * 1000).toISOString()

  const { data: recovered } = await (service
    .from('wa_outbox') as any)
    .update({
      status:          'queued',
      processing_at:   null,
      last_error_code: ERR_RECOVERED_FROM_TIMEOUT,
      error_message:   `Worker sebelumnya crash atau kehabisan budget saat memproses baris ini. Di-recover otomatis setelah ${RECOVERY_THRESHOLD_MINUTES} menit.`,
    })
    .eq('status', 'processing')
    .lt('processing_at', recoveryBefore)
    .select('id')

  const recoveredCount = Array.isArray(recovered) ? recovered.length : 0

  // ── Phase 2: Claim next batch ────────────────────────────────────────────
  // Note: SELECT then UPDATE is not atomic. A true FOR UPDATE SKIP LOCKED
  // requires a Postgres RPC (P1 backlog). At current throughput the race
  // window is small; it becomes P1 priority as invocation overlap is routine.
  const { data: rows, error: fetchErr } = await (service
    .from('wa_outbox') as any)
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (fetchErr) {
    console.error('[process-queue] Gagal ambil batch:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const batch = (rows ?? []) as any[]
  if (batch.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, recovered: recoveredCount })
  }

  // Mark all claimed rows as 'processing' before entering the loop.
  // If this invocation is killed before finishing, the recovery sweep above
  // will reset any remaining 'processing' rows on the next invocation.
  const batchIds = batch.map(r => r.id)
  await (service
    .from('wa_outbox') as any)
    .update({ status: 'processing', processing_at: now.toISOString() })
    .in('id', batchIds)

  // ── Phase 3: Process batch ───────────────────────────────────────────────
  let sent        = 0
  let failed      = 0
  let retrying    = 0
  let stoppedEarly = false

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i]

    // Budget check and delay for all messages after the first.
    // The worker stops gracefully when remaining budget would be too short
    // for another delay + Fonnte send cycle. Unprocessed rows stay in
    // 'processing' and are recovered by the next invocation's Phase 1 sweep.
    let appliedDelaySeconds: number | null = null
    if (i > 0) {
      const elapsed   = Date.now() - invocationStart
      const remaining = BUDGET_MS - elapsed
      if (remaining < MIN_CYCLE_MS) {
        stoppedEarly = true
        break
      }
      const delayMs       = row.delay_seconds != null ? row.delay_seconds * 1000 : randomDelayMs()
      appliedDelaySeconds = Math.round(delayMs / 1000)
      await sleep(delayMs)
    }

    const result      = await sendViaFonnte(
      row.fonnte_token,
      row.target_phone    ?? null,
      row.target_group_id ?? null,
      row.message,
    )
    const { contains, count } = detectUrls(row.message)
    const newAttempts         = (row.attempts as number) + 1

    if (result.ok) {
      const sentAt = new Date()

      await Promise.all([
        (service.from('wa_outbox') as any)
          .update({
            status:          'sent',
            attempts:        newAttempts,
            sent_at:         sentAt.toISOString(),
            last_error_code: null,
            error_message:   null,
            fonnte_response: { ok: true, provider_message_id: result.providerMessageId },
          })
          .eq('id', row.id),

        (service.from('wa_message_log') as any)
          .insert({
            user_id:             row.user_id,
            contact_phone:       row.target_phone ?? row.target_group_id,
            contact_name:        row.contact_name ?? null,
            direction:           'outbound',
            message_type:        row.message_type,
            message_content:     row.message,
            contains_url:        contains,
            url_count:           count,
            character_count:     (row.message as string).length,
            source_route:        row.source_route,
            success:             true,
            sent_at:             sentAt.toISOString(),
            bot_phone:           row.bot_phone ?? null,
            provider_message_id: result.providerMessageId ?? null,
            outbox_id:           row.id,
            queue_delay_seconds: appliedDelaySeconds,
          }),
      ])

      sent++
    } else {
      const canRetry      = newAttempts < (row.max_attempts as number)
      const isMaxAttempts = !canRetry
      const nextScheduledAt = canRetry
        ? new Date(Date.now() + RETRY_BASE_MS * newAttempts).toISOString()
        : null

      const lastErrorCode = isMaxAttempts
        ? ERR_MAX_ATTEMPTS_REACHED
        : (result.errorCode ?? ERR_FONNTE_REJECTED)

      await Promise.all([
        (service.from('wa_outbox') as any)
          .update({
            status:          canRetry ? 'queued' : 'failed',
            attempts:        newAttempts,
            scheduled_at:    canRetry ? nextScheduledAt : row.scheduled_at,
            failed_at:       canRetry ? null : new Date().toISOString(),
            last_error_code: lastErrorCode,
            error_message:   result.errorMessage ?? 'Unknown error',
            fonnte_response: { ok: false, error_code: result.errorCode, error: result.errorMessage },
          })
          .eq('id', row.id),

        (service.from('wa_message_log') as any)
          .insert({
            user_id:         row.user_id,
            contact_phone:   row.target_phone ?? row.target_group_id,
            contact_name:    row.contact_name ?? null,
            direction:       'outbound',
            message_type:    row.message_type,
            message_content: row.message,
            contains_url:    contains,
            url_count:       count,
            character_count: (row.message as string).length,
            source_route:    row.source_route,
            success:         false,
            error_message:   result.errorMessage ?? null,
            bot_phone:       row.bot_phone ?? null,
            outbox_id:       row.id,
            queue_delay_seconds: appliedDelaySeconds,
          }),
      ])

      if (canRetry) retrying++
      else failed++
    }
  }

  return NextResponse.json({
    ok:           true,
    processed:    batch.length,
    sent,
    failed,
    retrying,
    recovered:    recoveredCount,
    stopped_early: stoppedEarly,
    elapsed_ms:   Date.now() - invocationStart,
  })
}
