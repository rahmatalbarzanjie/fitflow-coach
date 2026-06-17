import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await request.json().catch(() => ({}))
  if (!phone || typeof phone !== 'string' || phone.trim().length < 9) {
    return NextResponse.json({ error: 'Nomor WhatsApp tidak valid' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ bot_phone_requested: phone.trim() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
