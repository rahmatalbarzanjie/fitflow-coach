import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp'
import { checkBroadcastQuota } from '@/lib/quota'

/**
 * Idempotent: broadcast_recipients adalah sumber kebenaran status per-penerima.
 * Klik "Kirim" berkali-kali aman - recipient yang sudah status 'sent' DI-SKIP,
 * hanya recipient 'pending'/'failed' yang diproses ulang. Tidak ada lagi
 * kemungkinan satu member menerima broadcast yang sama dua kali akibat retry
 * setelah timeout.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bc } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!bc) return NextResponse.json({ error: 'Broadcast tidak ditemukan' }, { status: 404 })
  if ((bc as any).status === 'sent') return NextResponse.json({ error: 'Broadcast sudah terkirim sebelumnya' }, { status: 400 })

  // Cek koneksi WA SEBELUM resolve target/buat recipient - gagal cepat dan
  // jelas, jangan biarkan instruktur kira ada yang terkirim padahal belum
  // pernah terhubung sama sekali.
  const { data: profile } = await supabase
    .from('profiles')
    .select('fonnte_token')
    .eq('id', user.id)
    .single()
  const instructorToken = (profile as { fonnte_token: string | null } | null)?.fonnte_token ?? null
  if (!instructorToken) {
    return NextResponse.json({ error: 'WhatsApp belum terhubung. Hubungkan WA di Pengaturan terlebih dahulu.' }, { status: 400 })
  }

  const audience = (bc as any).target_audience as string

  // Resolve target member IDs berdasarkan audience
  let memberIds: string[] | null = null
  if (audience !== 'all') {
    const { data: summaryRows } = await supabase
      .from('member_summary')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', audience)
    memberIds = (summaryRows ?? []).map((m: any) => m.id)
  }

  let memberQuery = supabase
    .from('members')
    .select('id, name, phone')
    .eq('user_id', user.id)
    .not('phone', 'is', null)

  if (memberIds !== null) memberQuery = memberQuery.in('id', memberIds)

  const { data: membersData } = await memberQuery
  const targetMembers = (membersData ?? []) as { id: string; name: string; phone: string }[]

  if (targetMembers.length === 0) {
    await supabase
      .from('broadcasts')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: 0 })
      .eq('id', id)
    return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: 0 })
  }

  // Pastikan setiap target punya row broadcast_recipients - INSERT cuma yang
  // belum ada (unique index broadcast_id+member_id mencegah duplikat kalau
  // ada race condition antar klik).
  const { data: existingRows } = await supabase
    .from('broadcast_recipients')
    .select('id, member_id, phone, name, status')
    .eq('broadcast_id', id)

  const existingByMember = new Map((existingRows ?? []).map((r: any) => [r.member_id, r]))

  const toInsert = targetMembers
    .filter(m => !existingByMember.has(m.id))
    .map(m => ({ broadcast_id: id, member_id: m.id, phone: m.phone, name: m.name, status: 'pending' }))

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from('broadcast_recipients').insert(toInsert)
    if (insertErr) {
      return NextResponse.json({ error: `Gagal menyiapkan daftar penerima: ${insertErr.message}` }, { status: 500 })
    }
  }

  const { data: allRows } = await supabase
    .from('broadcast_recipients')
    .select('id, member_id, phone, name, status')
    .eq('broadcast_id', id)

  const allRecipients     = (allRows ?? []) as { id: string; member_id: string | null; phone: string | null; name: string; status: string }[]
  const pendingRecipients = allRecipients.filter(r => r.status !== 'sent')

  if (pendingRecipients.length === 0) {
    // Semua recipient sudah pernah sukses terkirim di percobaan sebelumnya
    await supabase
      .from('broadcasts')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: allRecipients.length })
      .eq('id', id)
    return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: allRecipients.length })
  }

  // Kuota dicek terhadap jumlah pengiriman BARU (bukan total target) - blok
  // SEBELUM mulai kirim kalau sisa kuota tidak cukup.
  const quota = await checkBroadcastQuota(supabase, user.id, pendingRecipients.length)
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: `Kuota broadcast bulan ini tidak cukup. Butuh ${pendingRecipients.length} kiriman, sisa kuota ${quota.remaining ?? 0}/${quota.limit}. Upgrade paket atau kurangi target audience.`,
      },
      { status: 403 }
    )
  }

  const title   = (bc as any).title   as string
  const content = (bc as any).content as string
  const message = `*${title}*\n\n${content}`

  let sentNow   = 0
  let failedNow = 0

  for (const r of pendingRecipients) {
    if (!r.phone) {
      await (supabase.from('broadcast_recipients') as any)
        .update({ status: 'failed', error: 'Nomor HP tidak ada' })
        .eq('id', r.id)
      failedNow++
      continue
    }

    const ok = await sendWhatsApp(r.phone, message, instructorToken)
    if (ok) {
      await (supabase.from('broadcast_recipients') as any)
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', r.id)
      sentNow++
    } else {
      await (supabase.from('broadcast_recipients') as any)
        .update({ status: 'failed', error: 'Gagal kirim via Fonnte' })
        .eq('id', r.id)
      failedNow++
    }
  }

  // broadcast_recipients adalah sumber kebenaran - hitung ulang dari sana,
  // bukan dari counter lokal sentNow (supaya konsisten kalau request lain
  // ikut menulis recipient yang sama secara paralel).
  const { data: finalRows } = await supabase
    .from('broadcast_recipients')
    .select('status')
    .eq('broadcast_id', id)

  const finalStatuses = (finalRows ?? []) as { status: string }[]
  const totalSent     = finalStatuses.filter(r => r.status === 'sent').length
  const allDone        = finalStatuses.length > 0 && finalStatuses.every(r => r.status === 'sent')

  await supabase
    .from('broadcasts')
    .update({
      recipient_count: totalSent,
      ...(allDone ? { status: 'sent', sent_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)

  return NextResponse.json({
    ok:      true,
    sent:    sentNow,
    failed:  failedNow,
    skipped: allRecipients.length - pendingRecipients.length,
  })
}
