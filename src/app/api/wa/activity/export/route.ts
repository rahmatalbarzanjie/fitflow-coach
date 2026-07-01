import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function parseDateRange(preset?: string | null, dateFrom?: string | null, dateTo?: string | null) {
  if (preset) {
    const now = new Date()
    switch (preset) {
      case 'today': { const s = new Date(now); s.setHours(0,0,0,0); return { from: s.toISOString(), to: now.toISOString() } }
      case '7d':    return { from: new Date(now.getTime() - 7*86400_000).toISOString(), to: now.toISOString() }
      case '30d':   return { from: new Date(now.getTime() - 30*86400_000).toISOString(), to: now.toISOString() }
      case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() }
    }
  }
  return { from: dateFrom ?? null, to: dateTo ?? null }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp      = new URL(request.url).searchParams
  const { from, to } = parseDateRange(sp.get('date_preset'), sp.get('date_from'), sp.get('date_to'))
  const direction    = sp.get('direction')
  const typeRaw      = sp.get('message_type')
  const status       = sp.get('status')
  const contact      = sp.get('contact')

  let q = (supabase
    .from('wa_message_log') as any)
    .select('created_at, contact_name, contact_phone, direction, message_type, success, message_content, error_message, contains_url, url_count, character_count, source_route, queue_delay_seconds')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10_000)

  if (from)      q = q.gte('created_at', from)
  if (to)        q = q.lte('created_at', to)
  if (direction && (direction === 'inbound' || direction === 'outbound')) q = q.eq('direction', direction)
  if (typeRaw) {
    const types = typeRaw.split(',').map(t => t.trim()).filter(Boolean)
    if (types.length === 1) q = q.eq('message_type', types[0])
    else if (types.length > 1) q = q.in('message_type', types)
  }
  if (status === 'sent')   q = q.eq('success', true)
  if (status === 'failed') q = q.eq('success', false)
  if (contact)  q = q.or(`contact_name.ilike.%${contact}%,contact_phone.ilike.%${contact}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as any[]

  const TYPE_LABEL: Record<string, string> = {
    registration: 'Pendaftaran Kelas', event: 'Pendaftaran Event', broadcast: 'Broadcast',
    community: 'Undangan Komunitas', feedback: 'Permintaan Feedback', chatbot: 'Chatbot',
    reminder: 'Pengingat', manual: 'Manual', system: 'Sistem',
  }

  const headers = ['Waktu','Nama Kontak','Nomor WA','Arah','Kategori','Status','Pesan','Error','Mengandung URL','Jumlah URL','Panjang Karakter','Sumber','Jeda Antrian (detik)']
  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...rows.map(r => [
      r.created_at,
      r.contact_name,
      r.contact_phone,
      r.direction === 'outbound' ? 'Keluar' : 'Masuk',
      TYPE_LABEL[r.message_type] ?? r.message_type,
      r.success ? 'Terkirim' : 'Gagal',
      r.message_content,
      r.error_message,
      r.contains_url ? 'Ya' : 'Tidak',
      r.url_count,
      r.character_count,
      r.source_route,
      r.queue_delay_seconds,
    ].map(escapeCSV).join(',')),
  ].join('\n')

  const filename = `wa-activity-${new Date().toISOString().split('T')[0]}.csv`

  return new Response('﻿' + csvRows, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
