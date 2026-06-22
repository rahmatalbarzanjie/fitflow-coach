import type { SupabaseClient } from '@supabase/supabase-js'

// Konversi ke WIB (UTC+7) - pola sama dengan classes/[id]/page.tsx,
// members/[id]/page.tsx. toISOString() selalu UTC; geser dulu 7 jam
// supaya tanggal yang dihasilkan cocok dengan tanggal WIB asli, bukan
// mundur 1 hari selama jam 00:00-07:00 WIB.
function getTodayWIB(): string {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return wib.toISOString().split('T')[0]
}

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

// "Aktif" di sini sengaja mengikuti definisi yang sudah dipakai di tempat
// lain di codebase (landing page, M9) - classes.is_active, events
// published+belum lewat tanggal, membership_packages.is_active - bukan
// definisi baru. Membership package TIDAK dihitung sebagai "usage aktif
// publik" karena belum ada jalur pembelian publik sama sekali untuk
// package (cuma instructor assign manual dari dashboard) - lihat
// getPaymentProfileUsage di bawah, packages tetap ditampilkan tapi tidak
// menaikkan severity warning.

/**
 * Hitungan usage aktif untuk SEMUA payment profile milik user sekaligus -
 * dipakai di halaman list (cuma butuh angka untuk warna badge, bukan nama).
 */
export async function getActiveUsageCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<Record<string, { classes: number; events: number; packages: number }>> {
  const today = getTodayWIB()

  const [classesRes, eventsRes, packagesRes] = await Promise.all([
    supabase.from('classes').select('payment_profile_id').eq('user_id', userId).eq('is_active', true).not('payment_profile_id', 'is', null),
    supabase.from('events').select('payment_profile_id').eq('user_id', userId).eq('status', 'published').gte('event_date', today).not('payment_profile_id', 'is', null),
    supabase.from('membership_packages').select('payment_profile_id').eq('user_id', userId).eq('is_active', true).not('payment_profile_id', 'is', null),
  ])

  const counts: Record<string, { classes: number; events: number; packages: number }> = {}
  const bump = (rows: { payment_profile_id: string | null }[] | null, key: 'classes' | 'events' | 'packages') => {
    ;(rows ?? []).forEach(r => {
      if (!r.payment_profile_id) return
      counts[r.payment_profile_id] ??= { classes: 0, events: 0, packages: 0 }
      counts[r.payment_profile_id][key]++
    })
  }
  bump(classesRes.data, 'classes')
  bump(eventsRes.data, 'events')
  bump(packagesRes.data, 'packages')

  return counts
}

/**
 * Daftar nama entitas aktif yang memakai SATU payment profile - dipakai di
 * halaman detail (di sini user memang sedang investigasi profile ini).
 */
export async function getPaymentProfileUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  profileId: string
): Promise<{ classes: { id: string; name: string }[]; events: { id: string; title: string }[]; packages: { id: string; name: string }[] }> {
  const today = getTodayWIB()

  const [classesRes, eventsRes, packagesRes] = await Promise.all([
    supabase.from('classes').select('id, name').eq('payment_profile_id', profileId).eq('is_active', true).order('name'),
    supabase.from('events').select('id, title').eq('payment_profile_id', profileId).eq('status', 'published').gte('event_date', today).order('event_date'),
    supabase.from('membership_packages').select('id, name').eq('payment_profile_id', profileId).eq('is_active', true).order('name'),
  ])

  return {
    classes:  classesRes.data ?? [],
    events:   eventsRes.data ?? [],
    packages: packagesRes.data ?? [],
  }
}
