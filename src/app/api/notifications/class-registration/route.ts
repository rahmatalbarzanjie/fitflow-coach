import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatDate, formatTime } from '@/lib/utils'
import { enqueueWhatsApp } from '@/lib/wa-queue'

/*
 * POST /api/notifications/class-registration
 * Dipanggil dari ClassRegistrationForm (publik, tanpa login) tepat setelah
 * insert sukses - enqueue notifikasi ke peserta dan ke instruktur (tanpa URL).
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
    .select('phone, fonnte_token, bot_phone')
    .eq('id', reg.user_id)
    .single()

  const instructorToken = (profile as any)?.fonnte_token ?? null
  const instructorPhone = (profile as any)?.phone         ?? null
  const botPhone        = (profile as any)?.bot_phone     ?? null

  if (!instructorToken) {
    return NextResponse.json({ ok: true, queued: false, reason: 'token tidak ada' })
  }

  const name      = reg.registrant_name
  const cls       = reg.classes as any
  const className = cls?.name ?? 'kelas'

  const detailLines =
    `📅 ${formatDate(reg.session_date)}\n` +
    `⏰ ${formatTime(cls?.start_time ?? '')} – ${formatTime(cls?.end_time ?? '')}` +
    (cls?.location ? `\n📍 ${cls.location}` : '')

  let participantMsg = `Halo *${name}*! 🎉\n\nPendaftaranmu untuk *${className}* sudah kami terima ✅\n\n${detailLines}\n\n`
  if (reg.payment_method === 'transfer') {
    participantMsg += `Kami akan konfirmasi pembayaranmu setelah cek bukti transfer ya. Mohon ditunggu 🙏`
  } else if (reg.payment_method === 'cash') {
    participantMsg += `Jangan lupa bayar di tempat saat kelas ya. Sampai jumpa di kelas! 💪`
  } else {
    participantMsg += `Sampai jumpa di kelas! 💪`
  }

  const methodLabel = reg.payment_method === 'transfer' ? 'Transfer (menunggu konfirmasi)'
    : reg.payment_method === 'cash' ? 'OTS (sudah confirmed)'
      : 'Gratis'

  const instructorMsg =
    `📥 *Pendaftaran Baru*\n\n` +
    `*${className}*\n\n` +
    `Peserta: ${name}\n` +
    `${formatDate(reg.session_date)}\n` +
    `Metode: ${methodLabel}`

  const commonArgs = {
    supabase,
    userId:      reg.user_id,
    fonnteToken: instructorToken,
    sourceRoute: '/api/notifications/class-registration',
    botPhone,
  } as const

  // Dua pesan dienqueue terpisah; worker akan terapkan delay di antara keduanya.
  // Kegagalan enqueue tidak membatalkan response (registrasi sudah di-commit di DB),
  // tapi dicatat di wa_message_log secara internal oleh enqueueWhatsApp().
  const participantId = await enqueueWhatsApp({
    ...commonArgs,
    phone:       reg.registrant_phone,
    message:     participantMsg,
    messageType: 'registration',
    contactName: name,
  })

  let instructorId: string | null = null
  if (instructorPhone) {
    instructorId = await enqueueWhatsApp({
      ...commonArgs,
      phone:       instructorPhone,
      message:     instructorMsg,
      messageType: 'registration',
      contactName: name,
    })
  }

  return NextResponse.json({
    ok:     true,
    queued: { participant: !!participantId, instructor: !!instructorId },
  })
}
