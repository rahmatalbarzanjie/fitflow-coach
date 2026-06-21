import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fonnteGetQr, fonnteGetDeviceProfile, fonnteIsDeviceConnected } from '@/lib/whatsapp'
import { getSystemConfig } from '@/lib/system-config'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('fonnte_token, bot_phone, bot_phone_requested')
    .eq('id', user.id)
    .single()

  const token = (profile as any)?.fonnte_token
  if (!token) return NextResponse.json({ error: 'Belum ada device yang diprovisikan' }, { status: 400 })

  if ((profile as any)?.bot_phone) {
    // Jangan percaya kolom bot_phone selamanya - device bisa logout di HP
    // tanpa app kita pernah tahu. Verifikasi live ke Fonnte; hanya flip ke
    // disconnected kalau Fonnte EKSPLISIT bilang begitu (bukan saat API
    // gagal/ambigu - jangan salah putus koneksi cuma karena hiccup).
    const masterToken = (await getSystemConfig('fonnte_token')) || process.env.FONNTE_TOKEN
    const live = masterToken ? await fonnteIsDeviceConnected(masterToken, token) : null

    if (live === false) {
      await supabase.from('profiles').update({ bot_phone: null }).eq('id', user.id)
      return NextResponse.json({ connected: false })
    }
    return NextResponse.json({ connected: true, phone: (profile as any).bot_phone })
  }

  const status = await fonnteGetQr(token)

  if (status.connected) {
    // /device Fonnte kadang balas "token invalid" walau device-nya benar
    // sudah connect (tidak konsisten di sisi Fonnte) - tanpa fallback ini,
    // bot_phone tidak pernah tersimpan, dan instruktur balik ke layar
    // "menghubungkan" terus padahal HP-nya sudah connect.
    const phone = await fonnteGetDeviceProfile(token) ?? (profile as any)?.bot_phone_requested ?? null
    if (phone) {
      await supabase.from('profiles').update({ bot_phone: phone }).eq('id', user.id)
    }
    return NextResponse.json({ connected: true, phone: phone ?? undefined })
  }

  return NextResponse.json({ connected: false, qr: status.qr })
}
