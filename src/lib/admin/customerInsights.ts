import { createServiceClient } from '@/lib/supabase/service'

// Tipe baris instructor_funnel_status / instructor_health_tier (migrasi 079).
// Belum ada di src/types/database.ts karena file itu hasil `supabase gen
// types` terhadap DB live - jalankan ulang generator setelah migrasi 079
// di-apply, lalu hapus cast `as any` di bawah dan pindah dua interface ini
// supaya langsung dari Database['public']['Views'].

export type FunnelStage = 'signup' | 'setup' | 'go_live' | 'first_traction' | 'activated'
export type ContentType = 'class_led' | 'event_led' | 'mixed' | null
export type HealthTier = 'healthy' | 'needs_attention' | 'at_risk' | 'inactive'

export interface InstructorFunnelStatus {
  user_id: string
  business_name: string | null
  slug: string | null
  m0_confirmed_at: string | null
  m1_identity_complete: boolean
  m2_content_created: boolean
  m3_published: boolean
  m4_registration_received: boolean
  activated_at: string | null
  is_activated: boolean
  content_type: ContentType
  path_a_started: boolean
  membership_awaiting_count: number
  membership_awaiting_overdue_count: number
  stage: FunnelStage
}

export interface InstructorHealthTier {
  user_id: string
  activated_at: string | null
  last_operational_activity_at: string | null
  active_class_count: number
  wa_ever_connected: boolean
  /**
   * BUKAN status realtime - hanya menunjukkan token+nomor WA masih tersimpan
   * di database kita, bukan status koneksi sungguhan di Fonnte saat ini.
   * Dibuktikan lewat insiden GetFuel: Fonnte melaporkan disconnect padahal
   * field ini masih true. Deteksi disconnect realtime menunggu migrasi
   * histori koneksi WA (Phase 2) - jangan dipakai untuk klaim "tersambung
   * sekarang" di UI.
   */
  wa_previously_connected: boolean
  subscription_status: string | null
  trial_expires_at: string | null
  health_tier: HealthTier
}

/**
 * Customer List / Dashboard: satu query agregat untuk SEMUA instruktur.
 * Jangan dipanggil per-baris (N+1) - lihat catatan performa di
 * docs/PLATFORM_ADMIN_V1_PRE_IMPLEMENTATION_REVIEW.md Part F.
 */
export async function listInstructorFunnelStatus(): Promise<InstructorFunnelStatus[]> {
  const supabase = createServiceClient()
  const { data, error } = await (supabase.from as any)('instructor_funnel_status').select('*')
  if (error) throw new Error(`listInstructorFunnelStatus: ${error.message}`)
  return (data ?? []) as InstructorFunnelStatus[]
}

export async function listInstructorHealthTier(): Promise<InstructorHealthTier[]> {
  const supabase = createServiceClient()
  const { data, error } = await (supabase.from as any)('instructor_health_tier').select('*')
  if (error) throw new Error(`listInstructorHealthTier: ${error.message}`)
  return (data ?? []) as InstructorHealthTier[]
}

/**
 * Customer Detail (/admin/[profileId]): satu instruktur.
 */
export async function getInstructorFunnelStatus(userId: string): Promise<InstructorFunnelStatus | null> {
  const supabase = createServiceClient()
  const { data, error } = await (supabase.rpc as any)('get_instructor_funnel_status', { p_user_id: userId })
  if (error) throw new Error(`getInstructorFunnelStatus: ${error.message}`)
  const rows = (data ?? []) as InstructorFunnelStatus[]
  return rows[0] ?? null
}

export async function getInstructorHealthTier(userId: string): Promise<InstructorHealthTier | null> {
  const supabase = createServiceClient()
  const { data, error } = await (supabase.rpc as any)('get_instructor_health_tier', { p_user_id: userId })
  if (error) throw new Error(`getInstructorHealthTier: ${error.message}`)
  const rows = (data ?? []) as InstructorHealthTier[]
  return rows[0] ?? null
}
