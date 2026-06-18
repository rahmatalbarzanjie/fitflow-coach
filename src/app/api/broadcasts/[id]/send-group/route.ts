import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppToGroup } from '@/lib/whatsapp'
import { checkBroadcastQuota } from '@/lib/quota'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quota = await checkBroadcastQuota(supabase, user.id)
  if (!quota.ok) {
    return NextResponse.json(
      { error: `Kuota broadcast bulan ini sudah habis (${quota.used}/${quota.limit}). Upgrade paket untuk kirim lebih banyak.` },
      { status: 403 }
    )
  }

  const { data: bc } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!bc) return NextResponse.json({ error: 'Broadcast tidak ditemukan' }, { status: 404 })

  const targetClassId = (bc as any).target_class_id as string | null
  if (!targetClassId) {
    return NextResponse.json({ error: 'Broadcast ini tidak diset untuk kirim ke grup' }, { status: 400 })
  }
  if ((bc as any).group_sent_at) {
    return NextResponse.json({ error: 'Sudah terkirim ke grup sebelumnya' }, { status: 400 })
  }

  const [{ data: cls }, { data: profile }] = await Promise.all([
    supabase.from('classes').select('wa_group_id, wa_group_name').eq('id', targetClassId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('fonnte_token').eq('id', user.id).single(),
  ])

  const groupId = (cls as { wa_group_id: string | null } | null)?.wa_group_id ?? null
  if (!groupId) {
    return NextResponse.json({ error: 'Kelas ini belum terhubung ke grup WA' }, { status: 400 })
  }

  const instructorToken = (profile as { fonnte_token: string | null } | null)?.fonnte_token ?? null
  const title   = (bc as any).title   as string
  const content = (bc as any).content as string
  const message = `*${title}*\n\n${content}`

  const ok = await sendWhatsAppToGroup(groupId, message, instructorToken)
  if (!ok) return NextResponse.json({ error: 'Gagal kirim ke grup WA' }, { status: 500 })

  await supabase
    .from('broadcasts')
    .update({ group_sent_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
