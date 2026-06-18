import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'

/*
 * POST /api/notifications/class-registration
 * Dipanggil dari ClassRegistrationForm (publik, tanpa login) tepat setelah
 * insert sukses — kasih kabar ke peserta bahwa pendaftarannya sudah diterima.
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
    .select('registrant_name, registrant_phone, payment_method, user_id, classes(name)')
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

  const name      = reg.registrant_name
  const className = (reg.classes as any)?.name ?? 'kelas'

  let message = `Halo *${name}*! 🎉\n\nPendaftaranmu untuk *${className}* sudah kami terima ✅\n\n`
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
    const instructorMsg =
      `🔔 *Pendaftaran Baru*\n\n` +
      `${name} (${reg.registrant_phone}) baru daftar *${className}*\n` +
      `Metode: ${methodLabel}`
    await sendWhatsApp(instructorPhone, instructorMsg, instructorToken)
  }

  return NextResponse.json({ ok: true, sent })
}
