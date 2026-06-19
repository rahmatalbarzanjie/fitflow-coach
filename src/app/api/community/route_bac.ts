import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, phone, classId, notes } = await request.json().catch(() => ({}))
  if (!name && !phone) {
    return NextResponse.json({ error: 'Isi minimal nama atau nomor HP' }, { status: 400 })
  }

  const { error } = await supabase
    .from('community_contacts')
    .insert({
      user_id:  user.id,
      name:     name || null,
      phone:    phone || null,
      class_id: classId || null,
      notes:    notes || null,
      source:   'manual',
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
