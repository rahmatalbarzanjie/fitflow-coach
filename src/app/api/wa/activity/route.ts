import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Label display untuk message_type - dipakai juga di frontend
export const WA_TYPE_LABEL: Record<string, string> = {
  registration: 'Pendaftaran Kelas',
  event:        'Pendaftaran Event',
  broadcast:    'Broadcast',
  community:    'Undangan Komunitas',
  feedback:     'Permintaan Feedback',
  chatbot:      'Chatbot',
  reminder:     'Pengingat',
  manual:       'Manual',
  system:       'Sistem',
}

// Helper: parse date preset ke range ISO string
function parseDateRange(
  preset?: string | null,
  dateFrom?: string | null,
  dateTo?: string | null,
): { from: string | null; to: string | null } {
  if (preset) {
    const now = new Date()
    switch (preset) {
      case 'today': {
        const start = new Date(now); start.setHours(0,0,0,0)
        return { from: start.toISOString(), to: now.toISOString() }
      }
      case '7d': {
        const start = new Date(now.getTime() - 7 * 86400_000)
        return { from: start.toISOString(), to: now.toISOString() }
      }
      case '30d': {
        const start = new Date(now.getTime() - 30 * 86400_000)
        return { from: start.toISOString(), to: now.toISOString() }
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: start.toISOString(), to: now.toISOString() }
      }
    }
  }
  return { from: dateFrom ?? null, to: dateTo ?? null }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url    = new URL(request.url)
  const sp     = url.searchParams

  const preset    = sp.get('date_preset')
  const dateFrom  = sp.get('date_from')
  const dateTo    = sp.get('date_to')
  const direction = sp.get('direction')   // 'inbound' | 'outbound'
  const typeRaw   = sp.get('message_type') // comma-separated
  const status    = sp.get('status')      // 'sent' | 'pending' | 'failed'
  const contact   = sp.get('contact')     // search by name or phone
  const page      = parseInt(sp.get('page') ?? '1', 10)
  const pageSize  = Math.min(parseInt(sp.get('page_size') ?? '50', 10), 200)

  const { from, to } = parseDateRange(preset, dateFrom, dateTo)

  let q = (supabase
    .from('wa_message_log') as any)
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (from) q = q.gte('created_at', from)
  if (to)   q = q.lte('created_at', to)
  if (direction && (direction === 'inbound' || direction === 'outbound')) {
    q = q.eq('direction', direction)
  }
  if (typeRaw) {
    const types = typeRaw.split(',').map(t => t.trim()).filter(Boolean)
    if (types.length === 1) q = q.eq('message_type', types[0])
    else if (types.length > 1) q = q.in('message_type', types)
  }
  if (status === 'sent')    q = q.eq('success', true)
  if (status === 'failed')  q = q.eq('success', false)
  // 'pending' = ada di outbox tapi belum ada di message_log;
  // tidak bisa di-filter di message_log, tapi disertakan untuk kelengkapan UI
  if (contact) {
    q = q.or(`contact_name.ilike.%${contact}%,contact_phone.ilike.%${contact}%`)
  }

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, page_size: pageSize })
}
