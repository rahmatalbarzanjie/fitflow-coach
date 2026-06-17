import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Calendar, Clock, BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatDateShort, formatRupiah } from '@/lib/utils'
import { TrialManager } from '@/components/admin/TrialManager'

export default async function AdminInstructorDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params

  // Admin check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound()

  const serviceSupabase = createServiceClient()

  // Get profile
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single()

  if (!profile) notFound()

  // Fetch email from auth (profiles table doesn't store email)
  const { data: { user: authUser } } = await serviceSupabase.auth.admin.getUserById(profileId)
  const email = authUser?.email ?? '—'

  const p = profile as any
  const now = new Date()
  const trialExpired = p.trial_expires_at && new Date(p.trial_expires_at) < now
  const trialDaysLeft = p.trial_expires_at
    ? Math.max(0, Math.ceil((new Date(p.trial_expires_at).getTime() - now.getTime()) / 86_400_000))
    : null
  const status = p.subscription_status ?? 'trial'

  // Get instructor's data (bypass RLS with service client)
  const [
    { count: classCount },
    { count: memberCount },
    { count: sessionCount },
    { data: recentSessions },
    { data: classes },
  ] = await Promise.all([
    serviceSupabase.from('classes').select('*', { count: 'exact', head: true }).eq('user_id', profileId).eq('is_active', true),
    serviceSupabase.from('members').select('*', { count: 'exact', head: true }).eq('user_id', profileId),
    serviceSupabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', profileId),
    serviceSupabase.from('sessions').select('id, session_date, class_id, classes(name)').eq('user_id', profileId).order('session_date', { ascending: false }).limit(5),
    serviceSupabase.from('classes').select('id, name, class_price, revenue_share_pct, day_of_week').eq('user_id', profileId).eq('is_active', true).limit(10),
  ])

  // Estimate monthly revenue
  const estimatedMonthly = (classes as any[] ?? []).reduce((sum: number, cls: any) => {
    const price = cls.class_price ?? 0
    const share = cls.revenue_share_pct ?? 50
    return sum + (price * share / 100) * 4 // ~4 sessions/month per class
  }, 0)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{p.business_name ?? p.name}</h1>
          {p.business_name && <p className="text-sm text-gray-400">{p.name}</p>}
        </div>
        <TrialManager profileId={profileId} currentStatus={status} trialExpiresAt={p.trial_expires_at ?? null} />
      </div>

      {/* Profile info */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Info Akun</h2>
        <dl className="space-y-2">
          {[
            ['Email',   email],
            ['No. WA',  p.phone ?? '—'],
            ['Slug',    p.slug ? `/${p.slug}` : '—'],
            ['Status',  status === 'active' ? '✅ Berlangganan' : trialExpired ? '🔴 Trial Habis' : `🔵 Trial · ${trialDaysLeft} hari lagi`],
            ['Trial s/d', p.trial_expires_at ? formatDateShort(p.trial_expires_at) : '—'],
            ['Daftar',   formatDateShort(p.created_at ?? new Date().toISOString())],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-gray-900 font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Kelas Aktif',  value: classCount  ?? 0, icon: Calendar,  color: 'text-violet-600' },
          { label: 'Member',       value: memberCount ?? 0, icon: Users,     color: 'text-blue-600'   },
          { label: 'Total Sesi',   value: sessionCount ?? 0, icon: Clock,    color: 'text-green-600'  },
          { label: 'Est. / Bulan', value: formatRupiah(estimatedMonthly), icon: BarChart3, color: 'text-orange-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-3">
            <Icon className={`w-4 h-4 ${color} mb-1`} />
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </Card>
        ))}
      </div>

      {/* Classes */}
      {(classes as any[] ?? []).length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Kelas Aktif</h2>
          <div className="space-y-2">
            {(classes as any[]).map((cls: any) => (
              <div key={cls.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">{cls.name}</span>
                <span className="text-xs text-gray-400">
                  {cls.class_price ? `${formatRupiah(cls.class_price)} · ${cls.revenue_share_pct ?? 50}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent sessions */}
      {(recentSessions as any[] ?? []).length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Sesi Terbaru</h2>
          <div className="space-y-1.5">
            {(recentSessions as any[]).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-500">{formatDateShort(s.session_date)}</span>
                <span className="text-gray-700">{(s.classes as any)?.name ?? '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
