import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, phone } = await request.json().catch(() => ({}))
  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Nama dan nomor HP wajib diisi' }, { status: 400 })
  }

  const { data: contact } = await supabase
    .from('community_contacts')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!contact) return NextResponse.json({ error: 'Kontak tidak ditemukan' }, { status: 404 })

  const { data: member, error: memberErr } = await supabase
    .from('members')
    .insert({ user_id: user.id, name: name.trim(), phone: phone.trim() })
    .select('id')
    .single()

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  await supabase
    .from('community_contacts')
    .update({ converted_member_id: member.id })
    .eq('id', id)

  return NextResponse.json({ ok: true, memberId: member.id })
}
