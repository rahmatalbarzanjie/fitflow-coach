import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await request.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'sessionId wajib' }, { status: 400 })

  // Verifikasi sesi milik instruktur yang login
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

  const [{ data: profile }, { data: attendees }, { data: existingInvites }] = await Promise.all([
    supabase.from('profiles').select('slug, fonnte_token').eq('id', user.id).single(),
    supabase
      .from('attendance')
      .select('member_id, members(id, name, phone)')
      .eq('session_id', sessionId),
    supabase.from('feedback_invites').select('member_id').eq('session_id', sessionId),
  ])

  const slug          = (profile as any)?.slug
  const instructorToken = (profile as any)?.fonnte_token ?? null
  const appUrl         = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const alreadyInvited = new Set(((existingInvites ?? []) as any[]).map(i => i.member_id))

  const newAttendees = ((attendees ?? []) as any[])
    .filter(a => a.members && !alreadyInvited.has(a.member_id))

  let sent = 0
  const skipped = ((attendees ?? []).length) - newAttendees.length

  for (const a of newAttendees) {
    const member = a.members as { id: string; name: string; phone: string }
    const { data: invite } = await supabase
      .from('feedback_invites')
      .insert({ user_id: user.id, session_id: sessionId, member_id: member.id, phone: member.phone })
      .select('id')
      .single()

    if (!invite) continue

    const link = `${appUrl}/${slug}/feedback/${invite.id}`
    const message = [
      `Halo ${member.name}! 👋`,
      ``,
      `Boleh minta waktu sebentar untuk kasih kritik & saran soal kelas yang baru kamu ikuti? Jawabanmu anonim, tidak akan diketahui siapa penulisnya.`,
      ``,
      link,
    ].join('\n')

    const ok = await sendWhatsApp(member.phone, message, instructorToken)
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, sent, skipped })
}
