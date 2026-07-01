import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueWhatsApp } from '@/lib/wa-queue'
import { checkBroadcastQuota } from '@/lib/quota'

/**
 * Idempotent: broadcast_recipients adalah sumber kebenaran daftar target.
 * Klik "Kirim" berkali-kali aman - recipient yang sudah status 'pending'
 * (= sudah masuk antrian) atau 'sent' DI-SKIP.
 *
 * Pengiriman aktual dilakukan oleh worker /api/wa/process-queue melalui
 * wa_outbox - tidak ada direct call ke Fonnte dari route ini.
 * Status delivery per recipient tersedia di WA Message Center
 * (wa_message_log, source_route = /api/broadcasts/{id}/send).
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('fonnte_token, bot_phone')
    .eq('id', user.id)
    .single()
  const instructorToken = (profile as any)?.fonnte_token ?? null
  const botPhone        = (profile as any)?.bot_phone    ?? null
  if (!instructorToken) {
    return NextResponse.json({ error: 'WhatsApp belum terhubung. Hubungkan WA di Pengaturan terlebih dahulu.' }, { status: 400 })
  }

  const audience = (bc as any).target_audience as string

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
    return NextResponse.json({ ok: true, queued: 0, failed: 0, skipped: 0 })
  }

  // Buat broadcast_recipients untuk target yang belum ada
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

  const allRecipients    = (allRows ?? []) as { id: string; member_id: string | null; phone: string | null; name: string; status: string }[]
  // Proses semua yang belum pernah berhasil masuk antrian ('pending') atau gagal sebelumnya
  const pendingRecipients = allRecipients.filter(r => r.status === 'pending' || r.status === 'failed')

  if (pendingRecipients.length === 0) {
    await supabase
      .from('broadcasts')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: allRecipients.length })
      .eq('id', id)
    return NextResponse.json({ ok: true, queued: 0, failed: 0, skipped: allRecipients.length })
  }

  const quota = await checkBroadcastQuota(supabase, user.id, pendingRecipients.length)
  if (!quota.ok) {
    return NextResponse.json(
      { error: `Kuota broadcast bulan ini tidak cukup. Butuh ${pendingRecipients.length} kiriman, sisa kuota ${quota.remaining ?? 0}/${quota.limit}. Upgrade paket atau kurangi target audience.` },
      { status: 403 }
    )
  }

  const title   = (bc as any).title   as string
  const content = (bc as any).content as string
  const message = `*${title}*\n\n${content}`

  // source_route menyertakan broadcast ID supaya wa_message_log bisa di-filter
  // per broadcast di Message Center tanpa tabel join tambahan
  const sourceRoute = `/api/broadcasts/${id}/send`

  let queuedNow = 0
  let failedNow = 0

  for (const r of pendingRecipients) {
    if (!r.phone) {
      await (supabase.from('broadcast_recipients') as any)
        .update({ status: 'failed', error: 'Nomor HP tidak ada' })
        .eq('id', r.id)
      failedNow++
      continue
    }

    const outboxId = await enqueueWhatsApp({
      supabase,
      userId:      user.id,
      phone:       r.phone,
      message,
      fonnteToken: instructorToken,
      messageType: 'broadcast',
      contactName: r.name,
      sourceRoute,
      botPhone,
    })

    if (outboxId) {
      // Tandai sudah masuk antrian - delivery aktual via worker
      await (supabase.from('broadcast_recipients') as any)
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', r.id)
      queuedNow++
    } else {
      await (supabase.from('broadcast_recipients') as any)
        .update({ status: 'failed', error: 'Gagal masuk antrian WA' })
        .eq('id', r.id)
      failedNow++
    }
  }

  // Update broadcasts header berdasarkan total yang berhasil antri
  const totalQueued = allRecipients.filter(r => r.status === 'sent').length + queuedNow
  await supabase
    .from('broadcasts')
    .update({
      recipient_count: totalQueued,
      status:          failedNow === 0 ? 'sent' : undefined,
      sent_at:         failedNow === 0 ? new Date().toISOString() : undefined,
    })
    .eq('id', id)

  return NextResponse.json({
    ok:      true,
    queued:  queuedNow,
    failed:  failedNow,
    skipped: allRecipients.length - pendingRecipients.length,
  })
}
