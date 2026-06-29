import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'

/*
 * POST /api/ai/daily-summary
 * Header: x-webhook-secret: {NODERED_WEBHOOK_SECRET}
 * Body:   { user_id: string }
 *
 * Kembalikan ringkasan harian dalam bentuk:
 *   - stats: data mentah
 *   - summary: teks WhatsApp yang bisa langsung dikirim ke instruktur
 *
 * Panggil dari Node-RED setiap pagi (misalnya jam 06.30).
 */

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.NODERED_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const { user_id } = body ?? {}
  if (!user_id) {
    return NextResponse.json({ error: 'user_id diperlukan' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  // ── Ambil data kemarin ────────────────────────────────────────────────────
  const [
    { data: sessions },
    { data: newMembers },
    { data: atRisk },
    { data: pendingRegs },
    { data: profile },
  ] = await Promise.all([
    // Sesi kemarin + kehadiran
    supabase
      .from('today_sessions')
      .select('class_name, class_type, start_time, attended_count, capacity, session_revenue')
      .eq('user_id', user_id)
      .eq('session_date', yesterday),

    // Member baru bergabung kemarin
    supabase
      .from('members')
      .select('name')
      .eq('user_id', user_id)
      .gte('created_at', yesterday + 'T00:00:00')
      .lt('created_at', today + 'T00:00:00'),

    // Member at risk saat ini
    supabase
      .from('member_summary')
      .select('name')
      .eq('user_id', user_id)
      .eq('status', 'at_risk'),

    // Registrasi event menunggu konfirmasi
    supabase
      .from('registrations')
      .select('id, registrant_name')
      .eq('user_id', user_id)
      .eq('payment_status', 'pending'),

    // Nama instruktur
    supabase
      .from('profiles')
      .select('name, business_name')
      .eq('id', user_id)
      .single(),
  ])

  const totalAttended = (sessions ?? []).reduce((s: number, r: any) => s + (r.attended_count ?? 0), 0)
  const totalRevenue  = (sessions ?? []).reduce((s: number, r: any) => s + Number(r.session_revenue ?? 0), 0)

  const stats = {
    date:             yesterday,
    instructor_name:  profile?.name ?? 'Instruktur',
    business_name:    profile?.business_name ?? '',
    sessions_count:   sessions?.length ?? 0,
    total_attended:   totalAttended,
    total_revenue:    totalRevenue,
    new_members:      newMembers?.length ?? 0,
    at_risk_count:    atRisk?.length ?? 0,
    pending_payments: pendingRegs?.length ?? 0,
    sessions:         sessions ?? [],
  }

  // ── Generate ringkasan AI ─────────────────────────────────────────────────
  let summary = ''
  try {
    const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const dateStr  = new Date(yesterday).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    const sessionLines = (sessions ?? []).map((s: any) =>
      `- ${s.class_name}: ${s.attended_count} hadir${s.capacity ? `/${s.capacity}` : ''}, Rp ${Number(s.session_revenue).toLocaleString('id')}`
    ).join('\n') || '- Tidak ada sesi kemarin'

    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 350,
      messages: [{
        role:    'user',
        content: `Kamu adalah asisten instruktur fitness. Tulis ringkasan harian via WhatsApp untuk instruktur bernama ${stats.instructor_name}.

Data kemarin (${dateStr}):
${sessionLines}
Member baru: ${stats.new_members}
Member at risk: ${stats.at_risk_count}
Pembayaran menunggu: ${stats.pending_payments}
Total pendapatan: Rp ${totalRevenue.toLocaleString('id-ID')}

Tulis pesan WhatsApp yang hangat, ringkas (max 2 paragraf), dan langsung ke poin. Mulai dengan sapaan pagi. Gunakan emoji secukupnya. Jangan gunakan markdown. Tulis hanya isi pesannya.`,
      }],
    })

    summary = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  } catch {
    // Fallback: ringkasan teks tanpa AI
    summary = `Selamat pagi, ${stats.instructor_name}! ☀️\n\nRingkasan kemarin: ${stats.sessions_count} sesi, ${stats.total_attended} member hadir, pendapatan Rp ${totalRevenue.toLocaleString('id-ID')}.${stats.pending_payments > 0 ? ` Ada ${stats.pending_payments} pembayaran menunggu konfirmasi.` : ''} Semangat hari ini! 💪`
  }

  return NextResponse.json({ ok: true, stats, summary })
}
