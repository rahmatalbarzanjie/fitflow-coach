import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'
import { formatDate, formatTime } from '@/lib/utils'

/*
 * POST /api/notifications/class-registration
 * Dipanggil dari ClassRegistrationForm (publik, tanpa login) tepat setelah
 * insert sukses — kasih kabar ke peserta bahwa pendaftarannya sudah diterima,
 * lengkap dengan detail kelas, dan ke instruktur dengan link langsung ke
 * halaman validasi (tinggal klik, tidak perlu buka browser & navigasi manual).
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
    .select('registrant_name, registrant_phone, payment_method, user_id, class_id, session_date, classes(name, location, start_time, end_time)')
    .eq('id', registrationId)
    .not('class_id', 'is', null)
    .single()

  if (!reg) return NextResponse.json({ error: 'Registrasi tidak ditemukan' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, fonnte_token')
    .eq('id', reg.user_id)
    .single()
  const instructorToken = (profile as { phone: string | null; fonnte_token: string | null } | null)?.fonnte_token ?? null
  const instructorPhone = (profile as { phone: string | null; fonnte_token: string | null } | null)?.phone ?? null

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const name      = reg.registrant_name
  const cls       = reg.classes as any
  const className = cls?.name ?? 'kelas'

  const detailLines =
    `📅 ${formatDate(reg.session_date)}\n` +
    `⏰ ${formatTime(cls?.start_time ?? '')} – ${formatTime(cls?.end_time ?? '')}` +
    (cls?.location ? `\n📍 ${cls.location}` : '')

  let message = `Halo *${name}*! 🎉\n\nPendaftaranmu untuk *${className}* sudah kami terima ✅\n\n${detailLines}\n\n`
  if (reg.payment_method === 'transfer') {
    message += `Kami akan konfirmasi pembayaranmu setelah cek bukti transfer ya. Mohon ditunggu 🙏`
  } else if (reg.payment_method === 'cash') {
    message += `Jangan lupa bayar di tempat saat kelas ya. Sampai jumpa di kelas! 💪`
  } else {
    message += `Sampai jumpa di kelas! 💪`
  }

  const sent = await sendWhatsApp(reg.registrant_phone, message, instructorToken)

  // Kabari instruktur juga — supaya tidak perlu cek manual ke web tiap saat
  if (instructorPhone) {
    const methodLabel = reg.payment_method === 'transfer' ? 'Transfer (menunggu konfirmasi)'
      : reg.payment_method === 'cash' ? 'OTS (sudah confirmed)'
      : 'Gratis'
    const validateLink = appUrl ? `${appUrl}/classes/${reg.class_id}/registrations` : null
    const instructorMsg =
      `🔔 *Pendaftaran Baru*\n\n` +
      `${name} (${reg.registrant_phone}) baru daftar *${className}*\n` +
      `${formatDate(reg.session_date)}\n` +
      `Metode: ${methodLabel}` +
      (validateLink ? `\n\n👉 Lihat & validasi:\n${validateLink}` : '')
    await sendWhatsApp(instructorPhone, instructorMsg, instructorToken)
  }

  return NextResponse.json({ ok: true, sent })
}
