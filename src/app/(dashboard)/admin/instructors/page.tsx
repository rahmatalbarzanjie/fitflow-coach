import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { AdminInstructorsList } from '@/components/admin/AdminInstructorsList'
import { listInstructorFunnelStatus, listInstructorHealthTier } from '@/lib/admin/customerInsights'

export default async function AdminInstructorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user?.email !== adminEmail) notFound()

  const serviceSupabase = createServiceClient()

  // Query profiles existing TIDAK diubah - funnel/health diambil paralel,
  // baru digabung di JS supaya query lama tetap aman kalau view baru
  // bermasalah (degradasi tetap dapat daftar instruktur, hanya tanpa badge).
  const [{ data: profilesRaw }, funnelRows, healthRows] = await Promise.all([
    serviceSupabase
      .from('profiles')
      .select('*')
      .neq('id', user!.id)
      .order('created_at', { ascending: false }),
    listInstructorFunnelStatus(),
    listInstructorHealthTier(),
  ])

  const funnelByUser = new Map(funnelRows.map(f => [f.user_id, f]))
  const healthByUser = new Map(healthRows.map(h => [h.user_id, h]))

  const profiles = ((profilesRaw ?? []) as any[]).map(p => {
    const funnel = funnelByUser.get(p.id)
    const health = healthByUser.get(p.id)
    return {
      ...p,
      stage: funnel?.stage ?? 'signup',
      is_activated: funnel?.is_activated ?? false,
      health_tier: health?.health_tier ?? null,
      last_operational_activity_at: health?.last_operational_activity_at ?? null,
    }
  })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-gray-700" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Instruktur</h1>
          <p className="text-sm text-gray-400">{profiles.length} instruktur terdaftar</p>
        </div>
      </div>

      <Card>
        <AdminInstructorsList profiles={profiles} />
      </Card>
    </div>
  )
}
