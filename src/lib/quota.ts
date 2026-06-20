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

interface BroadcastQuotaResult extends QuotaResult {
  remaining: number | null
}

/**
 * recipientCount = jumlah pengiriman BARU yang akan dilakukan (bukan total
 * target audience - recipient yang sudah pernah sukses terkirim di percobaan
 * sebelumnya tidak dihitung lagi, supaya retry yang idempotent tidak salah
 * dianggap menghabiskan kuota dua kali).
 *
 * ok = true hanya kalau sisa kuota CUKUP untuk seluruh recipientCount ini -
 * bukan sekadar "masih ada sisa kuota" (itu bug lama: bisa lolos walau
 * recipientCount jauh lebih besar dari sisa kuota, lalu kuota jadi negatif).
 */
export async function checkBroadcastQuota(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  recipientCount: number
): Promise<BroadcastQuotaResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('max_broadcast_per_month')
    .eq('id', userId)
    .single()

  const limit = (profile as { max_broadcast_per_month: number | null } | null)?.max_broadcast_per_month ?? null

  if (limit === null) return { ok: true, used: 0, limit: null, remaining: null }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  // Hitung dari broadcast_recipients langsung (bukan broadcasts.recipient_count
  // yang status-nya 'sent') - supaya pengiriman parsial dari broadcast yang
  // belum 100% selesai tetap terhitung kuotanya bulan ini.
  const { count } = await supabase
    .from('broadcast_recipients')
    .select('id, broadcasts!inner(user_id)', { count: 'exact', head: true })
    .eq('status', 'sent')
    .eq('broadcasts.user_id', userId)
    .gte('sent_at', monthStart.toISOString())

  const used      = count ?? 0
  const remaining = Math.max(limit - used, 0)
  return { ok: remaining >= recipientCount, used, limit, remaining }
}
