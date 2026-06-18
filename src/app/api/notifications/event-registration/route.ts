import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'
import { formatRupiah, formatDate, formatTime } from '@/lib/utils'
import { REGISTRATION_TIER } from '@/lib/constants'

/*
 * POST /api/notifications/event-registration
 * Dipanggil dari RegistrationForm (publik, tanpa login) tepat setelah
 * insert sukses - kasih kabar ke peserta (lengkap detail & info penting
 * event) + instruktur (dengan link langsung ke halaman validasi, tinggal
 * klik tidak perlu buka browser & navigasi manual).
 * Body: { registrationId: string }
 */
export async function POST(request: Request) {
  const { registrationId } = await request.json().catch(() => ({}))
  if (!registrationId) {
    return NextResponse.json({ error: 'Param tidak lengkap' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('registrant_name, registrant_phone, tier, amount_paid, user_id, event_id, events(title, event_date, start_time, end_time, location, description)')
    .eq('id', registrationId)
    .not('event_id', 'is', null)
    .single()

  if (!reg) return NextResponse.json({ error: 'Registrasi tidak ditemukan' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, fonnte_token')
    .eq('id', reg.user_id)
    .single()
  const instructorToken = (profile as { phone: string | null; fonnte_token: string | null } | null)?.fonnte_token ?? null
  const instructorPhone = (profile as { phone: string | null; fonnte_token: string | null } | null)?.phone ?? null

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const name       = reg.registrant_name
  const ev         = reg.events as any
  const eventTitle = ev?.title ?? 'event'

  const detailLines =
    `📅 ${formatDate(ev?.event_date)}\n` +
    `⏰ ${formatTime(ev?.start_time ?? '')}${ev?.end_time ? ` – ${formatTime(ev.end_time)}` : ''}` +
    (ev?.location ? `\n📍 ${ev.location}` : '') +
    (ev?.description ? `\n\n📋 Info penting:\n${ev.description}` : '')

  const participantMsg =
    `Halo *${name}*! 🎉\n\n` +
    `Pendaftaranmu untuk *${eventTitle}* sudah kami terima ✅\n\n` +
    `${detailLines}\n\n` +
    `Kami akan konfirmasi pembayaranmu setelah cek bukti transfer ya. Mohon ditunggu 🙏`

  const sent = await sendWhatsApp(reg.registrant_phone, participantMsg, instructorToken)

  // Kabari instruktur juga - supaya tidak perlu cek manual ke web tiap saat
  if (instructorPhone) {
    const tierLabel = REGISTRATION_TIER[reg.tier as keyof typeof REGISTRATION_TIER]?.label ?? reg.tier
    const validateLink = appUrl ? `${appUrl}/events/${reg.event_id}/registrations` : null
    const instructorMsg =
      `🔔 *Pendaftaran Baru*\n\n` +
      `${name} (${reg.registrant_phone}) baru daftar *${eventTitle}*\n` +
      `${tierLabel} · ${formatRupiah(Number(reg.amount_paid))}` +
      (validateLink ? `\n\n👉 Lihat & validasi:\n${validateLink}` : '\n\nCek bukti transfer & konfirmasi di halaman Kelola Peserta ya 🙏')
    await sendWhatsApp(instructorPhone, instructorMsg, instructorToken)
  }

  return NextResponse.json({ ok: true, sent })
}
