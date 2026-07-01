import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/wa/activity/delete
 * Soft-delete wa_message_log rows berdasarkan filter aktif.
 * Body: { date_preset?, date_from?, date_to?, direction?, message_type?, status?, contact? }
 * Returns: { deleted: number }
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { date_preset, date_from, date_to, direction, message_type, status, contact } = body

  function parseDateRange() {
    if (date_preset) {
      const now = new Date()
      switch (date_preset) {
        case 'today': { const s = new Date(now); s.setHours(0,0,0,0); return { from: s.toISOString(), to: now.toISOString() } }
        case '7d':    return { from: new Date(now.getTime() - 7*86400_000).toISOString(), to: now.toISOString() }
        case '30d':   return { from: new Date(now.getTime() - 30*86400_000).toISOString(), to: now.toISOString() }
        case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() }
      }
    }
    return { from: date_from ?? null, to: date_to ?? null }
  }

  const { from, to } = parseDateRange()

  // SELECT dulu untuk mendapat list ID yang akan di-soft-delete
  // (Supabase tidak support filter kompleks + update dalam satu query via JS client)
  let selectQ = (supabase
    .from('wa_message_log') as any)
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (from)      selectQ = selectQ.gte('created_at', from)
  if (to)        selectQ = selectQ.lte('created_at', to)
  if (direction && (direction === 'inbound' || direction === 'outbound')) selectQ = selectQ.eq('direction', direction)
  if (message_type) {
    const types = String(message_type).split(',').map((t: string) => t.trim()).filter(Boolean)
    if (types.length === 1) selectQ = selectQ.eq('message_type', types[0])
    else if (types.length > 1) selectQ = selectQ.in('message_type', types)
  }
  if (status === 'sent')   selectQ = selectQ.eq('success', true)
  if (status === 'failed') selectQ = selectQ.eq('success', false)
  if (contact)  selectQ = selectQ.or(`contact_name.ilike.%${contact}%,contact_phone.ilike.%${contact}%`)

  const { data: ids, error: selectErr } = await selectQ
  if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 })

  const rowIds = ((ids ?? []) as any[]).map(r => r.id)
  if (rowIds.length === 0) return NextResponse.json({ deleted: 0 })

  const { error: updateErr } = await (supabase
    .from('wa_message_log') as any)
    .update({ deleted_at: new Date().toISOString() })
    .in('id', rowIds)
    .eq('user_id', user.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ deleted: rowIds.length })
}
