import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Users, Clock, CheckCircle, XCircle, Shield, Bell, MessageCircle } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { TrialManager } from '@/components/admin/TrialManager'
import { RequestActions } from '@/components/admin/RequestActions'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user?.email !== adminEmail) notFound()

  const serviceSupabase = createServiceClient()

  const [pendingRes, profilesRes] = await Promise.all([
    serviceSupabase
      .from('instructor_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    serviceSupabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const pendingRequests = (pendingRes.data ?? []) as any[]
  const profiles        = (profilesRes.data ?? []) as any[]

  const now = new Date()
  const stats = {
    total:   profiles.length,
    trial:   profiles.filter(p => p.subscription_status === 'trial' || !p.subscription_status).length,
    active:  profiles.filter(p => p.subscription_status === 'active').length,
    expired: profiles.filter(p => p.trial_expires_at && new Date(p.trial_expires_at) < now).length,
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5 text-gray-700" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-400">Kelola instruktur terdaftar</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Instruktur', value: stats.total,   icon: Users,       color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Free Trial',       value: stats.trial,   icon: Clock,       color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Berlangganan',     value: stats.active,  icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Trial Habis',      value: stats.expired, icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50'    },
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

      {/* Pendaftaran Baru */}
      {pendingRequests.length > 0 && (
        <Card className="mb-6 border-orange-100 bg-orange-50/30">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              Pendaftaran Menunggu Konfirmasi
              <span className="ml-2 text-xs font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            </h2>
          </div>
          <div className="space-y-3">
            {pendingRequests.map((r: any) => (
              <div key={r.id} className="flex items-start justify-between p-3 bg-white rounded-xl border border-orange-100">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{r.business_name ?? r.name}</p>
                  {r.business_name && <p className="text-xs text-gray-500">{r.name}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">{r.email} · {r.phone}</p>
                  {r.city && <p className="text-xs text-gray-400">{r.city}</p>}
                  {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
                  <p className="text-xs text-gray-300 mt-1">Daftar: {formatDateShort(r.created_at)}</p>
                </div>
                <RequestActions requestId={r.id} name={r.name} email={r.email} phone={r.phone} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daftar instruktur */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Semua Instruktur</h2>
        <div className="space-y-3">
          {!profiles.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada instruktur terdaftar.</p>
          ) : profiles.map(p => {
            const trialExpired = p.trial_expires_at && new Date(p.trial_expires_at) < now
            const trialDaysLeft = p.trial_expires_at
              ? Math.max(0, Math.ceil((new Date(p.trial_expires_at).getTime() - now.getTime()) / 86_400_000))
              : null
            const status = p.subscription_status ?? 'trial'
            const botConnected = !!(p.fonnte_token && String(p.fonnte_token).trim().length > 10)

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
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      botConnected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <MessageCircle className="w-2.5 h-2.5" />
                      {botConnected ? 'Bot WA ✓' : 'Bot WA belum setup'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.phone ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Daftar: {formatDateShort(p.created_at ?? new Date().toISOString())}
                    {p.trial_expires_at && ` · Trial s/d ${formatDateShort(p.trial_expires_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Link
                    href={`/admin/${p.id}`}
                    className="text-xs text-gray-400 hover:text-violet-600 transition-colors"
                  >
                    Detail →
                  </Link>
                  <TrialManager
                    profileId={p.id}
                    currentStatus={status}
                    trialExpiresAt={p.trial_expires_at ?? null}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
