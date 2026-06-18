import type { SupabaseClient } from '@supabase/supabase-js'

interface QuotaResult {
  ok: boolean
  used: number
  limit: number | null
}

export async function checkClassQuota(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<QuotaResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('max_active_classes')
    .eq('id', userId)
    .single()

  const limit = (profile as { max_active_classes: number | null } | null)?.max_active_classes ?? null

  const { count } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)

  const used = count ?? 0
  return { ok: limit === null || used < limit, used, limit }
}

export async function checkBroadcastQuota(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<QuotaResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('max_broadcast_per_month')
    .eq('id', userId)
    .single()

  const limit = (profile as { max_broadcast_per_month: number | null } | null)?.max_broadcast_per_month ?? null

  if (limit === null) return { ok: true, used: 0, limit: null }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { data: rows } = await supabase
    .from('broadcasts')
    .select('recipient_count')
    .eq('user_id', userId)
    .eq('status', 'sent')
    .gte('sent_at', monthStart.toISOString())

  const used = (rows ?? []).reduce((sum: number, r: any) => sum + (r.recipient_count ?? 0), 0)
  return { ok: used < limit, used, limit }
}
