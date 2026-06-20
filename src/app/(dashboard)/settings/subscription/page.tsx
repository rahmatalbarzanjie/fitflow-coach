import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { Star, Calendar, BookOpen, Users, MessageSquare } from 'lucide-react'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function daysLeft(dateStr: string | null) {
  if (!dateStr) return null
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  return days
}

export default async function SettingsSubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('subscription_status, trial_expires_at, plan_name, max_active_classes, max_broadcast_per_month')
    .eq('id', user!.id)
    .single()

  // Hitung usage aktual
  const [classesRes, broadcastsRes] = await Promise.all([
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('broadcasts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .gte('created_at', new Date(new Date().setDate(1)).toISOString()), // bulan ini
  ])

  const status          = profile?.subscription_status ?? 'trial'
  const expiresAt       = profile?.trial_expires_at ?? null
  const planName        = profile?.plan_name ?? (status === 'active' ? 'Pro' : 'Trial')
  const maxClasses      = profile?.max_active_classes ?? null
  const maxBroadcast    = profile?.max_broadcast_per_month ?? null
  const activeClasses   = classesRes.count ?? 0
  const broadcastsMonth = broadcastsRes.count ?? 0
  const days            = daysLeft(expiresAt)

  const statusLabel = status === 'active' ? 'Aktif'
    : status === 'trial' ? 'Trial'
    : 'Tidak Aktif'

  const statusColor = status === 'active' ? 'text-green-600 bg-green-50 border-green-100'
    : status === 'trial' ? 'text-yellow-700 bg-yellow-50 border-yellow-100'
    : 'text-red-600 bg-red-50 border-red-100'

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/settings" title="Paket & Langganan" />

      {/* Status card */}
      <div className={`flex items-center gap-3 px-4 py-4 rounded-2xl border mb-4 ${statusColor}`}>
        <Star className="w-6 h-6 shrink-0" />
        <div>
          <p className="text-base font-bold">{planName}</p>
          <p className="text-xs mt-0.5">
            {status === 'trial' && days !== null
              ? days > 0
                ? `Trial berakhir ${formatDate(expiresAt)} (${days} hari lagi)`
                : 'Trial sudah berakhir'
              : status === 'active'
              ? 'Langganan aktif'
              : 'Langganan tidak aktif — hubungi admin'
            }
          </p>
        </div>
        <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Penggunaan */}
      <SectionList label="Penggunaan Bulan Ini">
        <DetailRow
          icon={<BookOpen className="w-4 h-4" />}
          label="Kelas Aktif"
          value={maxClasses ? `${activeClasses} / ${maxClasses}` : `${activeClasses} (tak terbatas)`}
          chevron={false}
        />
        <DetailRow
          icon={<MessageSquare className="w-4 h-4" />}
          label="Broadcast Terkirim"
          value={maxBroadcast ? `${broadcastsMonth} / ${maxBroadcast}` : `${broadcastsMonth} (tak terbatas)`}
          chevron={false}
        />
      </SectionList>

      {/* Info paket */}
      <SectionList label="Info Paket" footer="Untuk upgrade atau pertanyaan paket, hubungi admin FitFlow.">
        <DetailRow
          icon={<Star className="w-4 h-4" />}
          label="Paket Saat Ini"
          value={planName}
          chevron={false}
        />
        {expiresAt && status === 'trial' && (
          <DetailRow
            icon={<Calendar className="w-4 h-4" />}
            label="Berakhir"
            value={formatDate(expiresAt)}
            chevron={false}
          />
        )}
      </SectionList>

      {/* Banner upgrade jika trial */}
      {status === 'trial' && (days === null || days <= 7) && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-4 mt-2">
          <p className="text-sm font-semibold text-violet-800 mb-1">
            {days !== null && days <= 0 ? '⚠️ Trial kamu sudah berakhir' : '⏳ Trial hampir berakhir'}
          </p>
          <p className="text-xs text-violet-600 leading-relaxed">
            Hubungi admin FitFlow untuk aktivasi paket dan lanjutkan akses tanpa gangguan.
          </p>
        </div>
      )}
    </div>
  )
}
