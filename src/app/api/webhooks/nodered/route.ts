import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/*
 * POST /api/webhooks/nodered
 * Header: x-webhook-secret: {NODERED_WEBHOOK_SECRET}
 * Body:   { action: string, ...payload }
 *
 * Actions:
 *  refresh_statuses        – DEPRECATED, no-op (status member sekarang derived, lihat handler)
 *  get_pending_recipients  – ambil antrian broadcast yang belum terkirim
 *  mark_recipient          – tandai recipient sebagai sent/failed setelah WA dikirim
 *  get_stats               – ringkasan hari ini untuk satu instruktur
 */

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const incomingSecret = request.headers.get('x-webhook-secret')
  if (incomingSecret !== process.env.NODERED_WEBHOOK_SECRET) return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body || !body.action) return badRequest('action diperlukan')

  const supabase = createServiceClient()
  const { action } = body

  // ── Action: refresh_statuses (DEPRECATED, no-op) ────────────────────────────
  // Member Status Architecture Migration (2026-06-29): status member sekarang
  // DERIVED (dihitung dari last_attended_at setiap dibaca lewat view
  // member_summary), bukan disimpan+direfresh cron lagi -
  // refresh_member_statuses() RPC sudah dihapus dari database. Action ini
  // dibiarkan no-op (bukan dihapus total) supaya cron Node-RED lama yang
  // masih memanggil tiap tengah malam tidak gagal keras/berisik, sampai
  // flow-nya sendiri dinonaktifkan di sisi Node-RED.
  if (action === 'refresh_statuses') {
    return NextResponse.json({ ok: true, updated: 0, deprecated: true })
  }

  // ── Action: get_pending_recipients ────────────────────────────────────────
  // Kembalikan antrian broadcast yang belum terkirim ke WhatsApp.
  // Node-RED loop tiap record → kirim WA → panggil mark_recipient.
  // Payload opsional: { limit?: number }
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
    return NextResponse.json({ ok: true, recipients: data ?? [] })
  }

  // ── Action: mark_recipient ────────────────────────────────────────────────
  // Setelah Node-RED kirim WA, panggil ini untuk update status penerima.
  // Payload: { recipient_id: string, status: 'sent' | 'failed' }
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
  // Ringkasan cepat untuk satu instruktur - bisa Node-RED kirim ke WA instruktur.
  // Payload: { user_id: string }
  if (action === 'get_stats') {
    const { user_id } = body
    if (!user_id) return badRequest('user_id diperlukan')

    const today = new Date().toISOString().split('T')[0]

    const [{ data: todaySessions }, { data: pendingRegs }, { data: atRisk }] = await Promise.all([
      // Sesi hari ini + jumlah hadir
      supabase
        .from('today_sessions')
        .select('class_name, start_time, attended_count, session_revenue')
        .eq('user_id', user_id)
        .eq('session_date', today),

      // Registrasi event menunggu konfirmasi
      supabase
        .from('registrations')
        .select('id, registrant_name, event_id')
        .eq('user_id', user_id)
        .eq('payment_status', 'pending'),

      // Member at risk
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
        date:              today,
        sessions_today:    todaySessions?.length ?? 0,
        attended_today:    (todaySessions ?? []).reduce((s: number, r: any) => s + (r.attended_count ?? 0), 0),
        revenue_today:     totalRevenue,
        pending_payments:  pendingRegs?.length ?? 0,
        at_risk_members:   atRisk?.length ?? 0,
        sessions:          todaySessions ?? [],
      },
    })
  }

  return badRequest(`action '${action}' tidak dikenal`)
}

// GET: health check sederhana (bisa dipakai Node-RED untuk test koneksi)
export async function GET(request: Request) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.NODERED_WEBHOOK_SECRET) return unauthorized()
  return NextResponse.json({ ok: true, service: 'FitFlow Coach Webhook', ts: new Date().toISOString() })
}
