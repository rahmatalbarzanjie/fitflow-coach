import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get broadcast (must belong to this user)
  const { data: bc } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!bc) return NextResponse.json({ error: 'Broadcast tidak ditemukan' }, { status: 404 })
  if ((bc as any).status === 'sent') return NextResponse.json({ error: 'Broadcast sudah terkirim sebelumnya' }, { status: 400 })

  const audience = (bc as any).target_audience as string

  // Resolve target member IDs based on audience
  let memberIds: string[] | null = null
  if (audience !== 'all') {
    const { data: summaryRows } = await supabase
      .from('member_summary')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', audience)
    memberIds = (summaryRows ?? []).map((m: any) => m.id)
    if (memberIds.length === 0) {
      // Mark as sent with 0 recipients
      await supabase
        .from('broadcasts')
        .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: 0 })
        .eq('id', id)
      return NextResponse.json({ ok: true, sent: 0, failed: 0 })
    }
  }

  // Fetch member phone numbers
  let query = supabase
    .from('members')
    .select('id, name, phone')
    .eq('user_id', user.id)
    .not('phone', 'is', null)

  if (memberIds !== null) {
    query = query.in('id', memberIds)
  }

  const { data: members } = await query

  const title   = (bc as any).title   as string
  const content = (bc as any).content as string
  const message = `*${title}*\n\n${content}`

  let sent   = 0
  let failed = 0

  for (const m of (members ?? []) as { id: string; name: string; phone: string | null }[]) {
    if (!m.phone) { failed++; continue }
    const ok = await sendWhatsApp(m.phone, message)
    ok ? sent++ : failed++
  }

  await supabase
    .from('broadcasts')
    .update({
      status:          'sent',
      sent_at:         new Date().toISOString(),
      recipient_count: sent,
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, sent, failed })
}
