import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Users, Clock, CheckCircle, XCircle, Shield } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { TrialManager } from '@/components/admin/TrialManager'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Hanya admin yang boleh akses — set ADMIN_EMAIL di .env
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user?.email !== adminEmail) notFound()

  const serviceSupabase = createServiceClient()

  // Ambil semua profil instruktur (cast any karena kolom trial belum tentu ada di generated types)
  const { data: profilesRaw } = await serviceSupabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const profiles = profilesRaw as any[] | null

  const now = new Date()

  const stats = {
    total:   profiles?.length ?? 0,
    trial:   profiles?.filter(p => p.subscription_status === 'trial' || !p.subscription_status).length ?? 0,
    active:  profiles?.filter(p => p.subscription_status === 'active').length ?? 0,
    expired: profiles?.filter(p => {
      if (!p.trial_expires_at) return false
      return new Date(p.trial_expires_at) < now
    }).length ?? 0,
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5 text-violet-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Developer Panel</h1>
          <p className="text-sm text-gray-400">Kelola instruktur dan langganan</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Instruktur', value: stats.total,   icon: Users,        color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Free Trial',       value: stats.trial,   icon: Clock,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Berlangganan',     value: stats.active,  icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Trial Habis',      value: stats.expired, icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50'    },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Daftar instruktur */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Semua Instruktur</h2>
        <div className="space-y-3">
          {!profiles?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada instruktur terdaftar.</p>
          ) : profiles.map(p => {
            const trialExpired = p.trial_expires_at && new Date(p.trial_expires_at) < now
            const trialDaysLeft = p.trial_expires_at
              ? Math.max(0, Math.ceil((new Date(p.trial_expires_at).getTime() - now.getTime()) / 86_400_000))
              : null
            const status = p.subscription_status ?? 'trial'

            return (
              <div key={p.id} className="flex items-start justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{p.business_name ?? p.name}</p>
                    {p.slug && (
                      <span className="text-xs text-gray-400 font-mono">/{p.slug}</span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      status === 'active'  ? 'bg-green-100 text-green-700' :
                      trialExpired        ? 'bg-red-100 text-red-600'    :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {status === 'active' ? 'Aktif' : trialExpired ? 'Habis' : `Trial${trialDaysLeft !== null ? ` · ${trialDaysLeft}h` : ''}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.phone ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Daftar: {formatDateShort(p.created_at ?? new Date().toISOString())}
                    {p.trial_expires_at && ` · Trial s/d ${formatDateShort(p.trial_expires_at)}`}
                  </p>
                </div>
                <TrialManager
                  profileId={p.id}
                  currentStatus={status}
                  trialExpiresAt={p.trial_expires_at ?? null}
                />
              </div>
            )
          })}
        </div>
      </Card>

      {/* SQL Migration info */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <p className="text-xs font-semibold text-amber-700 mb-2">Setup database (jalankan 1x di Supabase SQL Editor):</p>
        <pre className="text-xs text-amber-700 bg-amber-100/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
{`ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- Set 1 bulan trial untuk semua user yang sudah ada
UPDATE profiles
SET trial_expires_at = NOW() + INTERVAL '30 days'
WHERE trial_expires_at IS NULL;`}
        </pre>
        <p className="text-xs text-amber-600 mt-2">
          Tambahkan <code className="bg-amber-100 px-1 rounded">ADMIN_EMAIL=email-kamu@domain.com</code> di file .env juga.
        </p>
      </div>
    </div>
  )
}
