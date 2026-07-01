import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueWhatsApp } from '@/lib/wa-queue'

/*
 * POST /api/notifications/registration
 * Dipanggil dari RegistrationActions setelah instruktur konfirmasi/tolak/batalkan.
 * Body: { registrationId: string, type: 'confirm' | 'reject' | 'invite' | 'cancel', reason?: string, wasConfirmed?: boolean }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { registrationId, type, reason, wasConfirmed } = await request.json().catch(() => ({}))
  if (!registrationId || !type) {
    return NextResponse.json({ error: 'Param tidak lengkap' }, { status: 400 })
  }

  const [{ data: reg }, { data: profile }] = await Promise.all([
    supabase
      .from('registrations')
      .select('registrant_name, registrant_phone, events(title), classes(name)')
      .eq('id', registrationId)
      .eq('user_id', user.id)
      .single(),
    supabase.from('profiles').select('fonnte_token, bot_phone').eq('id', user.id).single(),
  ])

  if (!reg) return NextResponse.json({ error: 'Registrasi tidak ditemukan' }, { status: 404 })

  const instructorToken = (profile as any)?.fonnte_token ?? null
  const botPhone        = (profile as any)?.bot_phone    ?? null

  if (!instructorToken) {
    return NextResponse.json({ ok: true, queued: false, reason: 'token tidak ada' })
  }

  const name      = reg.registrant_name
  const phone     = reg.registrant_phone
  const itemTitle = (reg.events as any)?.title ?? (reg.classes as any)?.name ?? 'kelas/event'

  let message = ''
  if (type === 'confirm') {
    message =
      `Halo *${name}*! 🎉\n\n` +
      `Pembayaranmu untuk *${itemTitle}* sudah kami konfirmasi ✅\n\n` +
      `Sampai jumpa di acara, ya! Jangan lupa simpan tiket ini 💪`
  } else if (type === 'reject') {
    message =
      `Halo *${name}*, mohon maaf 🙏\n\n` +
      `Pendaftaranmu untuk *${itemTitle}* belum bisa kami konfirmasi.` +
      (reason ? `\n\nAlasan: ${reason}` : '') +
      `\n\nSilakan hubungi kami jika ada pertanyaan ya 😊`
  } else if (type === 'invite') {
    message =
      `Halo *${name}*! 🎉\n\n` +
      `Kamu sekarang resmi jadi member tetap kami! Terima kasih sudah ikut *${itemTitle}* 💪\n\n` +
      `Sampai jumpa di kelas berikutnya ya!`
  } else if (type === 'cancel') {
    message =
      `Halo *${name}*,\n\n` +
      `Pendaftaranmu untuk *${itemTitle}* sudah dibatalkan.` +
      (wasConfirmed ? `\n\nUntuk info pengembalian dana, hubungi kami langsung ya 🙏` : '')
  } else {
    return NextResponse.json({ error: 'type tidak valid' }, { status: 400 })
  }

  const outboxId = await enqueueWhatsApp({
    supabase,
    userId:      user.id,
    phone,
    message,
    fonnteToken: instructorToken,
    messageType: 'registration',
    contactName: name,
    sourceRoute: '/api/notifications/registration',
    botPhone,
  })

  // This route is triggered by an instructor action (confirm/reject/cancel/invite).
  // The instructor is actively waiting on the outcome. Surface enqueue failures
  // explicitly so the caller can show an error in the UI.
  if (!outboxId) {
    return NextResponse.json(
      { ok: false, queued: false, error: 'Notifikasi WA gagal masuk antrian. Coba kirim ulang.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, queued: true })
}
