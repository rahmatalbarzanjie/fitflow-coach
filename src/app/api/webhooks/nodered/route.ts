import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/*
 * POST /api/webhooks/nodered
 * Header: x-webhook-secret: {NODERED_WEBHOOK_SECRET}
 * Body:   { action: string, ...payload }
 *
 * Actions:
 *  refresh_statuses        – DEPRECATED, no-op
 *  get_pending_recipients  – antrian broadcast (dengan fonnte_token per instruktur)
 *  mark_recipient          – tandai recipient sent/failed
 *  get_stats               – ringkasan hari ini untuk satu instruktur
 *  get_instructor_config   – data instruktur untuk Node-RED config (by slug)
 */

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

function rupiah(n: number) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export async function POST(request: Request) {
  const incomingSecret = request.headers.get('x-webhook-secret')
  if (incomingSecret !== process.env.NODERED_WEBHOOK_SECRET) return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body || !body.action) return badRequest('action diperlukan')

  const supabase = createServiceClient()
  const { action } = body

  // ── Action: refresh_statuses (DEPRECATED, no-op) ──────────────────────────
  if (action === 'refresh_statuses') {
    return NextResponse.json({ ok: true, updated: 0, deprecated: true })
  }

  // ── Action: get_pending_recipients ────────────────────────────────────────
  // Kembalikan antrian broadcast pending + fonnte_token per instruktur.
  // Node-RED menggunakan r.fonnte_token saat kirim WA - tidak perlu config per instruktur.
  if (action === 'get_pending_recipients') {
    const limit = Number(body.limit ?? 50)
    const { data, error } = await supabase
      .from('broadcast_recipients')
      .select(`
        id,
        phone,
        name,
        status,
        broadcast:broadcasts (
          id,
          content,
          user_id,
          title
        )
      `)
      .eq('status', 'pending')
      .order('created_at')
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const recipients = data ?? []

    // Ambil fonnte_token semua instruktur yang relevan dalam satu query
    const userIds = [...new Set(recipients.map(r => (r.broadcast as any)?.user_id).filter(Boolean))]
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, fonnte_token').in('id', userIds)
      : { data: [] }
    const tokenMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.fonnte_token]))

    const enriched = recipients.map(r => ({
      ...r,
      fonnte_token: tokenMap[(r.broadcast as any)?.user_id] ?? null,
    }))

    return NextResponse.json({ ok: true, recipients: enriched })
  }

  // ── Action: mark_recipient ────────────────────────────────────────────────
  if (action === 'mark_recipient') {
    const { recipient_id, status: recipStatus } = body
    if (!recipient_id) return badRequest('recipient_id diperlukan')
    if (!['sent', 'failed'].includes(recipStatus)) return badRequest('status harus sent atau failed')

    const { error } = await supabase
      .from('broadcast_recipients')
      .update({
        status:  recipStatus,
        sent_at: recipStatus === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', recipient_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Action: get_stats ─────────────────────────────────────────────────────
  // Ringkasan hari ini untuk satu instruktur. Payload: { user_id: string }
  if (action === 'get_stats') {
    const { user_id } = body
    if (!user_id) return badRequest('user_id diperlukan')

    const today = new Date().toISOString().split('T')[0]

    const [{ data: todaySessions }, { data: pendingRegs }, { data: atRisk }] = await Promise.all([
      supabase
        .from('today_sessions')
        .select('class_name, start_time, attended_count, session_revenue')
        .eq('user_id', user_id)
        .eq('session_date', today),
      supabase
        .from('registrations')
        .select('id, registrant_name, event_id')
        .eq('user_id', user_id)
        .eq('payment_status', 'pending'),
      supabase
        .from('member_summary')
        .select('id, name')
        .eq('user_id', user_id)
        .eq('status', 'at_risk'),
    ])

    const totalRevenue = (todaySessions ?? []).reduce(
      (s: number, r: any) => s + Number(r.session_revenue ?? 0), 0
    )

    return NextResponse.json({
      ok: true,
      stats: {
        date:             today,
        sessions_today:   todaySessions?.length ?? 0,
        attended_today:   (todaySessions ?? []).reduce((s: number, r: any) => s + (r.attended_count ?? 0), 0),
        revenue_today:    totalRevenue,
        pending_payments: pendingRegs?.length ?? 0,
        at_risk_members:  atRisk?.length ?? 0,
        sessions:         todaySessions ?? [],
      },
    })
  }

  // ── Action: get_instructor_config ────────────────────────────────────────
  // Data instruktur untuk inisialisasi Node-RED (by slug). Payload: { slug: string }
  if (action === 'get_instructor_config') {
    const { slug } = body
    if (!slug) return badRequest('slug diperlukan')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, phone, fonnte_token, bot_phone, name, business_name')
      .eq('slug', slug)
      .single()

    if (!profile) return NextResponse.json({ error: 'Instruktur tidak ditemukan' }, { status: 404 })

    return NextResponse.json({
      ok: true,
      config: {
        user_id:          profile.id,
        instructor_phone: (profile as any).phone         ?? null,
        fonnte_token:     (profile as any).fonnte_token  ?? null,
        bot_phone:        (profile as any).bot_phone     ?? null,
        name:             (profile as any).name          ?? null,
        business_name:    (profile as any).business_name ?? null,
      },
    })
  }

  return badRequest(`action '${action}' tidak dikenal`)
}

// GET: health check
export async function GET(request: Request) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.NODERED_WEBHOOK_SECRET) return unauthorized()
  return NextResponse.json({ ok: true, service: 'FuelOS Webhook', ts: new Date().toISOString() })
}
