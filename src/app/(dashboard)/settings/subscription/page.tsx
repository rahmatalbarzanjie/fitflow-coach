import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { Star, Calendar, BookOpen, MessageSquare } from 'lucide-react'

function getSubscriptionLabel(status: string | null, expiresAt: string | null) {
  if (status === 'active') return { label: 'Aktif', color: 'text-green-600', sub: 'Langganan aktif' }
  if (status === 'trial') {
    if (!expiresAt) return { label: 'Trial', color: 'text-yellow-600', sub: 'Periode trial' }
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    if (days <= 0) return { label: 'Trial Berakhir', color: 'text-red-600', sub: 'Langganan diperlukan' }
    return { label: 'Trial', color: 'text-yellow-600', sub: `Berakhir ${days} hari lagi` }
  }
  return { label: 'Tidak Aktif', color: 'text-red-600', sub: 'Hubungi admin' }
}

export default async function SettingsSubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('subscription_status, trial_expires_at, plan_name, max_active_classes, max_broadcast_per_month')
    .eq('id', user!.id)
    .single()

  const subStatus = getSubscriptionLabel(profile?.subscription_status ?? 'trial', profile?.trial_expires_at ?? null)
  const expiresLabel = profile?.trial_expires_at
    ? new Date(profile.trial_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-'

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/settings" title="Langganan" />

      <SectionList label="Paket">
        <DetailRow
          icon={<Star className="w-4 h-4" />}
          label={`Paket ${profile?.plan_name ?? 'Trial'}`}
          sublabel={subStatus.sub}
          value={subStatus.label}
          chevron={false}
        />
        <DetailRow
          icon={<Calendar className="w-4 h-4" />}
          label="Berakhir"
          value={expiresLabel}
          chevron={false}
        />
      </SectionList>

      <SectionList label="Kuota" footer="Hubungi admin untuk upgrade paket atau menambah kuota.">
        <DetailRow
          icon={<BookOpen className="w-4 h-4" />}
          label="Maksimal Kelas Aktif"
          value={profile?.max_active_classes != null ? String(profile.max_active_classes) : 'Tidak terbatas'}
          chevron={false}
        />
        <DetailRow
          icon={<MessageSquare className="w-4 h-4" />}
          label="Broadcast per Bulan"
          value={profile?.max_broadcast_per_month != null ? String(profile.max_broadcast_per_month) : 'Tidak terbatas'}
          chevron={false}
        />
      </SectionList>
    </div>
  )
}
