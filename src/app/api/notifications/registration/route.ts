import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp'

/*
 * POST /api/notifications/registration
 * Dipanggil dari RegistrationActions setelah instruktur konfirmasi/tolak.
 * Body: { registrationId: string, type: 'confirm' | 'reject', reason?: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { registrationId, type, reason } = await request.json().catch(() => ({}))
  if (!registrationId || !type) {
    return NextResponse.json({ error: 'Param tidak lengkap' }, { status: 400 })
  }

  // Ambil data registrasi + event title (pastikan milik instruktur ini)
  const [{ data: reg }, { data: profile }] = await Promise.all([
    supabase
      .from('registrations')
      .select('registrant_name, registrant_phone, events(title)')
      .eq('id', registrationId)
      .eq('user_id', user.id)
      .single(),
    supabase.from('profiles').select('fonnte_token').eq('id', user.id).single(),
  ])

  if (!reg) return NextResponse.json({ error: 'Registrasi tidak ditemukan' }, { status: 404 })
  const instructorToken = (profile as { fonnte_token: string | null } | null)?.fonnte_token ?? null

  const name      = reg.registrant_name
  const phone     = reg.registrant_phone
  const eventTitle = (reg.events as any)?.title ?? 'event'

  let message = ''
  if (type === 'confirm') {
    message =
      `Halo *${name}*! 🎉\n\n` +
      `Pembayaranmu untuk *${eventTitle}* sudah kami konfirmasi ✅\n\n` +
      `Sampai jumpa di acara, ya! Jangan lupa simpan tiket ini 💪`
  } else if (type === 'reject') {
    message =
      `Halo *${name}*, mohon maaf 🙏\n\n` +
      `Pendaftaranmu untuk *${eventTitle}* belum bisa kami konfirmasi.` +
      (reason ? `\n\nAlasan: ${reason}` : '') +
      `\n\nSilakan hubungi kami jika ada pertanyaan ya 😊`
  } else {
    return NextResponse.json({ error: 'type tidak valid' }, { status: 400 })
  }

  const sent = await sendWhatsApp(phone, message, instructorToken)
  return NextResponse.json({ ok: true, sent })
}
