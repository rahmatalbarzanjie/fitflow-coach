import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatRupiah, formatDate, formatTime } from '@/lib/utils'
import { REGISTRATION_TIER } from '@/lib/constants'
import { enqueueWhatsApp } from '@/lib/wa-queue'

/*
 * POST /api/notifications/event-registration
 * Dipanggil dari RegistrationForm (publik, tanpa login) tepat setelah
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
    .select('registrant_name, registrant_phone, tier, amount_paid, user_id, event_id, events(title, event_date, start_time, end_time, location, description)')
    .eq('id', registrationId)
    .not('event_id', 'is', null)
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

  const tierLabel = REGISTRATION_TIER[reg.tier as keyof typeof REGISTRATION_TIER]?.label ?? reg.tier

  const instructorMsg =
    `📥 *Pendaftaran Baru*\n\n` +
    `*${eventTitle}*\n\n` +
    `Peserta: ${name}\n` +
    `${tierLabel} · ${formatRupiah(Number(reg.amount_paid))}`

  const commonArgs = {
    supabase,
    userId:      reg.user_id,
    fonnteToken: instructorToken,
    sourceRoute: '/api/notifications/event-registration',
    botPhone,
  } as const

  const participantId = await enqueueWhatsApp({
    ...commonArgs,
    phone:       reg.registrant_phone,
    message:     participantMsg,
    messageType: 'event',
    contactName: name,
  })

  let instructorId: string | null = null
  if (instructorPhone) {
    instructorId = await enqueueWhatsApp({
      ...commonArgs,
      phone:       instructorPhone,
      message:     instructorMsg,
      messageType: 'event',
      contactName: name,
    })
  }

  return NextResponse.json({
    ok:     true,
    queued: { participant: !!participantId, instructor: !!instructorId },
  })
}
