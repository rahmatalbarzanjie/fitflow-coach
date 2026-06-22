import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Payment Profile yang siap dipilih di Class/Event/Membership Package -
 * harus aktif DAN punya minimal 1 metode pembayaran. Profile kosong atau
 * nonaktif tidak pernah muncul di dropdown manapun.
 */
export async function getEligiblePaymentProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<{ id: string; name: string }[]> {
  const { data: profiles } = await supabase
    .from('payment_profiles')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name')

  if (!profiles || profiles.length === 0) return []

  const { data: methods } = await supabase
    .from('payment_methods')
    .select('payment_profile_id')
    .in('payment_profile_id', profiles.map((p: { id: string }) => p.id))

  const idsWithMethod = new Set((methods ?? []).map((m: { payment_profile_id: string }) => m.payment_profile_id))
  return profiles.filter((p: { id: string }) => idsWithMethod.has(p.id))
}
