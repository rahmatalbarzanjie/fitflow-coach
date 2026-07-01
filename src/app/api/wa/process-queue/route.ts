import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/whatsapp'

// Vercel Pro serverless function limit. Requires Vercel Pro plan.
// Hobby plan caps at 10s — incompatible with this worker.
export const maxDuration = 300

// ── Constants ─────────────────────────────────────────────────────────────────

// Budget math (worst case, all messages hit MAX_DELAY):
//   First message : 0s delay + ~2s (Fonnte + DB) = 2s
//   Each remaining: MAX_DELAY_MS(8s) + ~2s (Fonnte + DB) = 10s
//   15 messages   : 2 + 14 × 10 = 142s  ← well within 300s
//   Headroom      : ~158s buffer for slow Fonnte or DB
const BATCH_SIZE          = 15
const MIN_DELAY_MS        = 3_000
const MAX_DELAY_MS        = 8_000

// Retry backoff: 30s after attempt 1, 60s after attempt 2, 90s after attempt 3.
const RETRY_BASE_MS       = 30_000

// A row stuck in 'processing' longer than this is considered orphaned.
// Must be > maxDuration (300s = 5min) to avoid recovering rows from a
// currently-running parallel invocation. 10 minutes gives a 2× safety margin.
const RECOVERY_THRESHOLD_MINUTES = 10

// Structured error codes written to wa_outbox.last_error_code.
// Queryable by support without reading server logs.
const ERR_FONNTE_REJECTED       = 'FONNTE_REJECTED'
const ERR_FONNTE_NETWORK        = 'FONNTE_NETWORK_ERROR'
const ERR_RECOVERED_FROM_TIMEOUT = 'RECOVERED_FROM_TIMEOUT'
const ERR_MAX_ATTEMPTS_REACHED  = 'MAX_ATTEMPTS_REACHED'

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

  const service = createServiceClient()
  const now     = new Date()

  // ── Phase 1: Stuck-processing recovery ──────────────────────────────────
  // Rows stuck in 'processing' beyond RECOVERY_THRESHOLD_MINUTES were left
  // by a prior invocation that timed out or crashed. Reset them to 'queued'
  // so they are picked up by this or a future invocation.
  // This runs BEFORE the batch SELECT so recovered rows can be included
  // in the current batch immediately.
  const recoveryBefore = new Date(now.getTime() - RECOVERY_THRESHOLD_MINUTES * 60 * 1000).toISOString()

  const { data: recovered } = await (service
    .from('wa_outbox') as any)
    .update({
      status:          'queued',
      processing_at:   null,
      last_error_code: ERR_RECOVERED_FROM_TIMEOUT,
      error_message:   `Worker sebelumnya timeout atau crash saat memproses baris ini. Di-recover otomatis setelah ${RECOVERY_THRESHOLD_MINUTES} menit.`,
    })
    .eq('status', 'processing')
    .lt('processing_at', recoveryBefore)
    .select('id')

  const recoveredCount = Array.isArray(recovered) ? recovered.length : 0

  // ── Phase 2: Claim next batch ────────────────────────────────────────────
  // Note: SELECT then UPDATE is not atomic. A true FOR UPDATE SKIP LOCKED
  // requires a Postgres RPC (tracked as P1). At current scale the race
  // window is negligible; it becomes a P1 concern as invocation overlap
  // becomes routine.
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

  // Mark all claimed rows as 'processing' before the loop begins.
  // If this invocation is killed, the recovery sweep above will reset them.
  const batchIds = batch.map(r => r.id)
  await (service
    .from('wa_outbox') as any)
    .update({ status: 'processing', processing_at: now.toISOString() })
    .in('id', batchIds)

  // ── Phase 3: Process batch ───────────────────────────────────────────────
  let sent     = 0
  let failed   = 0
  let retrying = 0

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i]

    // Apply delay before every message except the first in this batch.
    // Capture the actual delay so it can be stored in wa_message_log
    // (avoids the timestamp-subtraction bug where _sentAt is undefined
    // after a failure, producing garbage values).
    let appliedDelaySeconds: number | null = null
    if (i > 0) {
      const delayMs        = row.delay_seconds != null ? row.delay_seconds * 1000 : randomDelayMs()
      appliedDelaySeconds  = Math.round(delayMs / 1000)
      await sleep(delayMs)
    }

    const result      = await sendViaFonnte(
      row.fonnte_token,
      row.target_phone   ?? null,
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
      const canRetry        = newAttempts < (row.max_attempts as number)
      const isMaxAttempts   = !canRetry
      const nextScheduledAt = canRetry
        ? new Date(Date.now() + RETRY_BASE_MS * newAttempts).toISOString()
        : null

      // last_error_code: set the most specific code. If this was already
      // RECOVERED_FROM_TIMEOUT and is now failing Fonnte too, the Fonnte
      // error code takes precedence (it is the most recent actionable cause).
      // MAX_ATTEMPTS_REACHED is appended as a suffix only when retries are
      // exhausted, because the root cause (FONNTE_REJECTED etc.) is still
      // the most useful signal for support.
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
    ok:        true,
    processed: batch.length,
    sent,
    failed,
    retrying,
    recovered: recoveredCount,
  })
}
