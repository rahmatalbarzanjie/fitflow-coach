import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Users, Clock, CheckCircle, XCircle, Shield, Bell, Wallet, ArrowRight, MessageCircle, Smartphone } from 'lucide-react'
import { formatDateShort, formatRupiah } from '@/lib/utils'
import { RequestActions } from '@/components/admin/RequestActions'
import { ApproveLinkButton } from '@/components/admin/ApproveLinkButton'
import { fonnteGetDevices, type FonnteDeviceRow } from '@/lib/whatsapp'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user?.email !== adminEmail) notFound()

  const serviceSupabase = createServiceClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [pendingRes, profilesRes, paymentsRes, linkRequestsRes] = await Promise.all([
    serviceSupabase
      .from('instructor_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    serviceSupabase
      .from('profiles')
      .select('subscription_status, trial_expires_at')
      .neq('id', user!.id),
    serviceSupabase
      .from('payments')
      .select('amount')
      .gte('payment_date', startOfMonth.toISOString().split('T')[0]),
    serviceSupabase
      .from('profiles')
      .select('id, name, business_name, bot_phone_requested')
      .not('bot_phone_requested', 'is', null)
      .is('fonnte_token', null)
      .neq('id', user!.id),
  ])

  const pendingRequests = (pendingRes.data ?? []) as any[]
  const profiles        = (profilesRes.data ?? []) as any[]
  const monthlyRevenue  = ((paymentsRes.data ?? []) as any[]).reduce((sum, p) => sum + Number(p.amount), 0)
  const linkRequests    = (linkRequestsRes.data ?? []) as any[]

  // Info device fallback platform - terpisah dari device instruktur manapun,
  // cuma untuk notifikasi sistem (konfirmasi pendaftaran, dst). Murni
  // informasi, tidak pernah di-attach ke profile instruktur (lihat
  // approve-link/route.ts).
  const fallbackToken = process.env.FONNTE_TOKEN
  let fallbackDevice: FonnteDeviceRow | null = null
  if (fallbackToken) {
    const accountToken = fallbackToken // fallback token-nya sendiri dipakai sebagai account token untuk lookup
    const devices = await fonnteGetDevices(accountToken).catch(() => [])
    fallbackDevice = devices.find(d => d.token === fallbackToken) ?? null
  }

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
          <p className="text-sm text-gray-400">Overview platform FitFlow Coach</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Instruktur', value: stats.total,   icon: Users,       color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Free Trial',       value: stats.trial,   icon: Clock,       color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Berlangganan',     value: stats.active,  icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Akses Habis',      value: stats.expired, icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'Pendapatan Langganan Bulan Ini', value: formatRupiah(monthlyRevenue), icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
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

      {/* Permintaan Tautan Bot WA */}
      {linkRequests.length > 0 && (
        <Card className="mb-6 border-violet-100 bg-violet-50/30">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              Permintaan Tautan Bot WA
              <span className="ml-2 text-xs font-bold bg-violet-500 text-white px-2 py-0.5 rounded-full">
                {linkRequests.length}
              </span>
            </h2>
          </div>
          <div className="space-y-3">
            {linkRequests.map((p: any) => (
              <div key={p.id} className="flex items-start justify-between p-3 bg-white rounded-xl border border-violet-100">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{p.business_name ?? p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Nomor diajukan: {p.bot_phone_requested}</p>
                </div>
                <ApproveLinkButton profileId={p.id} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Device Fallback Platform - info saja, TIDAK pernah di-attach ke
          instruktur manapun (itu konsep yang berbeda, lihat approve-link). */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4 text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Device Fallback Platform</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {!fallbackToken
              ? 'Belum ada token fallback dikonfigurasi (FONNTE_TOKEN)'
              : fallbackDevice
              ? `${fallbackDevice.status === 'connect' ? 'Terhubung' : 'Tidak terhubung'} - ${fallbackDevice.name ?? fallbackDevice.device} (${fallbackDevice.device})`
              : 'Token terkonfigurasi, tapi device tidak ditemukan di Fonnte'}
          </p>
        </div>
      </div>

      <Link
        href="/admin/instructors"
        className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-violet-200 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Users className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Lihat Semua Instruktur</p>
            <p className="text-xs text-gray-400">Detail, status langganan, riwayat pembayaran per instruktur</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300" />
      </Link>
    </div>
  )
}
