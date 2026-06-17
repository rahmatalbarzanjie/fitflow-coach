import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('profiles')
    .select('bot_phone, fonnte_token')
    .eq('id', user.id)
    .single()

  const row = data as { bot_phone: string | null; fonnte_token: string | null } | null

  return NextResponse.json({
    bot_phone:    row?.bot_phone ?? '',
    has_token:    !!(row?.fonnte_token && row.fonnte_token.trim().length > 10),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bot_phone, fonnte_token } = await request.json().catch(() => ({}))

  const update: Record<string, string> = {}
  if (typeof bot_phone === 'string')    update.bot_phone    = bot_phone.trim()
  if (typeof fonnte_token === 'string' && fonnte_token.trim() !== '') {
    update.fonnte_token = fonnte_token.trim()
  }

  const serviceSupabase = createServiceClient()
  const { error } = await serviceSupabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
