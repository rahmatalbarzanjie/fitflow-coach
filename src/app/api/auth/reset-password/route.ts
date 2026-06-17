import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const { phone, otp, newPassword } = await request.json().catch(() => ({}))

  if (!phone || !otp || !newPassword) {
    return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
  }

  const target = normalizePhone(String(phone))
  const supabase = createServiceClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, phone')
    .not('phone', 'is', null)

  const match = ((profiles ?? []) as { id: string; phone: string | null }[])
    .find(p => p.phone && normalizePhone(p.phone) === target)

  if (!match) {
    return NextResponse.json({ error: 'Kode OTP salah atau sudah kadaluarsa' }, { status: 400 })
  }

  const { data: otpRow } = await supabase
    .from('password_reset_otps')
    .select('id')
    .eq('profile_id', match.id)
    .eq('otp_code', String(otp).trim())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!otpRow) {
    return NextResponse.json({ error: 'Kode OTP salah atau sudah kadaluarsa' }, { status: 400 })
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(match.id, {
    password: String(newPassword),
  })

  if (updateErr) {
    return NextResponse.json({ error: 'Gagal mengubah password. Coba lagi.' }, { status: 500 })
  }

  await supabase
    .from('password_reset_otps')
    .update({ used_at: new Date().toISOString() })
    .eq('id', otpRow.id)

  return NextResponse.json({ ok: true })
}
