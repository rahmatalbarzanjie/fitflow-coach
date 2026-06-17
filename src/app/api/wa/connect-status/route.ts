import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fonnteGetQr, fonnteGetDeviceProfile } from '@/lib/whatsapp'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('fonnte_token, bot_phone')
    .eq('id', user.id)
    .single()

  const token = (profile as any)?.fonnte_token
  if (!token) return NextResponse.json({ error: 'Belum ada device yang diprovisikan' }, { status: 400 })

  if ((profile as any)?.bot_phone) {
    return NextResponse.json({ connected: true, phone: (profile as any).bot_phone })
  }

  const status = await fonnteGetQr(token)

  if (status.connected) {
    const phone = await fonnteGetDeviceProfile(token)
    if (phone) {
      await supabase.from('profiles').update({ bot_phone: phone }).eq('id', user.id)
    }
    return NextResponse.json({ connected: true, phone: phone ?? undefined })
  }

  return NextResponse.json({ connected: false, qr: status.qr })
}
