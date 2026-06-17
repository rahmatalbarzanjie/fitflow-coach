import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp, normalizePhone } from '@/lib/whatsapp'

// Endpoint publik — tidak butuh login. Selalu balas sukses generik supaya
// tidak bisa dipakai mengecek nomor mana yang terdaftar (anti-enumeration).
const GENERIC_RESPONSE = NextResponse.json({
  ok: true,
  message: 'Kalau nomor ini terdaftar, kode OTP akan segera dikirim ke WhatsApp kamu.',
})

export async function POST(request: Request) {
  const { phone } = await request.json().catch(() => ({}))
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Nomor WA wajib diisi' }, { status: 400 })
  }

  const target = normalizePhone(phone)
  if (target.length < 9) return GENERIC_RESPONSE

  const supabase = createServiceClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, phone')
    .not('phone', 'is', null)

  const match = ((profiles ?? []) as { id: string; phone: string | null }[])
    .find(p => p.phone && normalizePhone(p.phone) === target)

  if (!match) return GENERIC_RESPONSE

  // Hapus OTP lama yang belum dipakai, supaya cuma 1 OTP aktif per akun
  await supabase
    .from('password_reset_otps')
    .delete()
    .eq('profile_id', match.id)
    .is('used_at', null)

  const otpCode = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await supabase.from('password_reset_otps').insert({
    profile_id: match.id,
    otp_code:   otpCode,
    expires_at: expiresAt,
  })

  const message = [
    `Kode OTP reset password FitFlow Coach kamu:`,
    ``,
    `*${otpCode}*`,
    ``,
    `Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.`,
  ].join('\n')

  await sendWhatsApp(match.phone!, message)

  return GENERIC_RESPONSE
}
