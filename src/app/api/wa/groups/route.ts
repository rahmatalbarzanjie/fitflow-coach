import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchWhatsAppGroups } from '@/lib/whatsapp'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('profiles')
    .select('fonnte_token')
    .eq('id', user.id)
    .single()

  const token = (data as { fonnte_token: string | null } | null)?.fonnte_token ?? null

  if (!token) {
    return NextResponse.json({ error: 'Token Fonnte belum diset di Pengaturan' }, { status: 400 })
  }

  const groups = await fetchWhatsAppGroups(token)
  return NextResponse.json({ groups })
}
