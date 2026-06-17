import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const { inviteId, content } = await request.json().catch(() => ({}))

  if (!inviteId || !content?.trim()) {
    return NextResponse.json({ error: 'Isi feedback tidak boleh kosong' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: invite } = await supabase
    .from('feedback_invites')
    .select('id, user_id, session_id, used')
    .eq('id', inviteId)
    .single()

  if (!invite) return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 })
  if ((invite as any).used) {
    return NextResponse.json({ error: 'Kamu sudah pernah mengirim feedback untuk sesi ini' }, { status: 409 })
  }

  // Sengaja tidak menyimpan member_id/invite_id apa pun di sini — anonim total
  const { error: insertErr } = await supabase.from('session_feedback').insert({
    user_id:    (invite as any).user_id,
    session_id: (invite as any).session_id,
    content:    content.trim(),
  })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  await supabase.from('feedback_invites').update({ used: true }).eq('id', inviteId)

  return NextResponse.json({ ok: true })
}
