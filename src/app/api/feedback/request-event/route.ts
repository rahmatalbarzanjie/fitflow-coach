import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId } = await request.json().catch(() => ({}))
  if (!eventId) return NextResponse.json({ error: 'eventId wajib' }, { status: 400 })

  const { data: event } = await supabase
    .from('events')
    .select('id, title, user_id')
    .eq('id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!event) return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 })

  const [{ data: profile }, { data: registrants }, { data: existingInvites }] = await Promise.all([
    supabase.from('profiles').select('slug, business_name, name, fonnte_token').eq('id', user.id).single(),
    supabase
      .from('registrations')
      .select('id, registrant_name, registrant_phone')
      .eq('event_id', eventId)
      .eq('attended', true),
    supabase.from('feedback_invites').select('registration_id').eq('event_id', eventId),
  ])

  const slug            = (profile as any)?.slug
  const studio           = (profile as any)?.business_name ?? (profile as any)?.name ?? 'kami'
  const instructorToken  = (profile as any)?.fonnte_token ?? null
  const appUrl           = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const alreadyInvited   = new Set(((existingInvites ?? []) as any[]).map(i => i.registration_id))

  const newRegistrants = ((registrants ?? []) as any[]).filter(r => !alreadyInvited.has(r.id))
  const skipped = ((registrants ?? []).length) - newRegistrants.length

  let sent = 0
  for (const r of newRegistrants) {
    const { data: invite } = await supabase
      .from('feedback_invites')
      .insert({ user_id: user.id, event_id: eventId, registration_id: r.id, phone: r.registrant_phone })
      .select('id')
      .single()

    if (!invite) continue

    const link = `${appUrl}/${slug}/feedback/${invite.id}`
    const message = [
      `Halo ${r.registrant_name}! 🙏`,
      ``,
      `Terima kasih banyak sudah ikut *${event.title}* bareng ${studio}. Semoga seru dan berkesan ya!`,
      ``,
      `Kalau ada waktu dan berkenan, boleh banget kasih kritik & saran lewat link ini (santai aja, opsional kok, gapapa kalau mau dilewati):`,
      link,
    ].join('\n')

    const ok = await sendWhatsApp(r.registrant_phone, message, instructorToken)
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, sent, skipped })
}
