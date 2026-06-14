import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/card'
import { Users, Calendar, Zap, TrendingUp, CheckCircle, Clock, ChevronRight, AlertCircle } from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { StatsSummary } from '@/components/dashboard/StatsSummary'
import { WeekCalendar } from '@/components/dashboard/WeekCalendar'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const [
    { count: totalMembers },
    { count: activeMembers },
    { count: todaySessions },
    { count: activeEvents },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'active'),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('session_date', today),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'published'),
  ])

  const { data: atRiskMembers } = await supabase
    .from('members')
    .select('id, name, phone, last_attended_at')
    .eq('user_id', user!.id)
    .eq('status', 'at_risk')
    .order('last_attended_at', { ascending: true })
    .limit(5)

  const { data: todaySchedule } = await supabase
    .from('today_sessions')
    .select('*')
    .eq('user_id', user!.id)
    .eq('session_date', today)
    .order('start_time')

  // Nearest upcoming event with registration counts
  const { data: nearestEvent } = await supabase
    .from('events')
    .select('id, title, event_date, slug, max_capacity, early_bird_price, ots_price')
    .eq('user_id', user!.id)
    .eq('status', 'published')
    .gte('event_date', today)
    .order('event_date')
    .limit(1)
    .single() as { data: any }

  const nearestEventRegs = nearestEvent
    ? await supabase
        .from('registrations')
        .select('payment_status')
        .eq('event_id', nearestEvent.id)
    : null

  const confirmedCount = nearestEventRegs?.data?.filter(r => r.payment_status === 'confirmed').length ?? 0
  const totalCount     = nearestEventRegs?.data?.length ?? 0

  // Pending payments across all events
  const { data: pendingRegs } = await supabase
    .from('registrations')
    .select('id, event_id, registrant_name, events!inner(title, user_id)')
    .eq('events.user_id', user!.id)
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  const pendingCount = pendingRegs?.length ?? 0

  // Group pending by event to get the most urgent event for link
  const pendingEventId = (pendingRegs as any[])?.[0]?.event_id ?? null

  const stats = [
    { label: 'Total Members', value: totalMembers ?? 0, icon: Users,      color: 'text-violet-600', bg: 'bg-violet-50', href: '/members'           },
    { label: 'Anggota Aktif', value: activeMembers ?? 0, icon: TrendingUp, color: 'text-green-600',  bg: 'bg-green-50',  href: '/members?status=active' },
    { label: 'Sesi Hari Ini', value: todaySessions ?? 0, icon: Calendar,   color: 'text-blue-600',   bg: 'bg-blue-50',   href: '/classes'           },
    { label: 'Event Aktif',   value: activeEvents ?? 0,  icon: Zap,        color: 'text-orange-600', bg: 'bg-orange-50', href: '/events'            },
  ]

  // Days until nearest event
  const daysUntil = nearestEvent
    ? Math.ceil((new Date(nearestEvent.event_date).getTime() - new Date(today).getTime()) / 86_400_000)
    : null

  const progressPct = nearestEvent?.max_capacity && confirmedCount
    ? Math.min(100, Math.round((confirmedCount / Number(nearestEvent.max_capacity)) * 100))
    : null

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatDate(new Date())}</p>
      </div>

      {/* Stat Cards — clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <Card className="p-5 hover:shadow-md hover:border-violet-100 transition-all cursor-pointer group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Row 1: Today + Konfirmasi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Today's Schedule */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Jadwal Hari Ini</h2>
            <span className="text-xs text-gray-400">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long' })}
            </span>
          </div>

          {!todaySchedule?.length ? (
            <div className="text-center py-8">
              <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Tidak ada sesi hari ini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(todaySchedule as any[]).map((s) => (
                <div key={s.session_id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.class_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {String(s.start_time).substring(0, 5)} – {String(s.end_time).substring(0, 5)}
                      {s.location && ` · ${s.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{s.attended_count} hadir</p>
                      <p className="text-xs text-gray-400">{formatRupiah(Number(s.session_revenue))}</p>
                    </div>
                    <Link
                      href={`/classes/${s.class_id}/attendance?date=${today}`}
                      className="flex items-center gap-1 h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Absen
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Konfirmasi Pembayaran */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Konfirmasi Pembayaran</h2>
            {pendingCount > 0 && (
              <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full font-medium">
                {pendingCount} pending
              </span>
            )}
          </div>

          {pendingCount === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-8 h-8 text-green-200 mx-auto mb-2" />
              <p className="text-sm text-green-600 font-medium">Semua pembayaran terkonfirmasi ✓</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(pendingRegs as any[]).slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.registrant_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.events?.title}</p>
                  </div>
                  <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">menunggu</span>
                </div>
              ))}
              {pendingCount > 5 && (
                <p className="text-xs text-gray-400 text-center">+{pendingCount - 5} lainnya</p>
              )}
              <Link
                href={pendingEventId ? `/events/${pendingEventId}/registrations` : '/events'}
                className="flex items-center justify-center gap-2 w-full h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors mt-2"
              >
                <AlertCircle className="w-4 h-4" />
                Lihat &amp; Konfirmasi
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Event Terdekat + At-Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Event Terdekat */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Event Terdekat</h2>
            <Link href="/events" className="text-xs text-violet-600 hover:underline">Semua event</Link>
          </div>

          {!nearestEvent ? (
            <div className="text-center py-8">
              <Zap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Belum ada event aktif</p>
              <Link href="/events/new" className="text-xs text-violet-600 hover:underline mt-1 block">
                + Buat event baru
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-base font-semibold text-gray-900">{nearestEvent.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-gray-500">{formatDate(nearestEvent.event_date)}</span>
                  {daysUntil !== null && daysUntil >= 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      daysUntil <= 3 ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'
                    }`}>
                      {daysUntil === 0 ? 'Hari ini!' : `${daysUntil} hari lagi`}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Peserta terkonfirmasi</span>
                  <span className="text-xs font-semibold text-gray-800">
                    {confirmedCount}{nearestEvent.max_capacity ? ` / ${nearestEvent.max_capacity}` : ''} peserta
                  </span>
                </div>
                {nearestEvent.max_capacity && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progressPct && progressPct >= 80 ? 'bg-orange-500' : 'bg-violet-500'}`}
                      style={{ width: `${progressPct ?? 0}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-orange-400" />
                  <span className="text-xs text-orange-500">{totalCount - confirmedCount} menunggu konfirmasi</span>
                </div>
              </div>

              <Link
                href={`/events/${nearestEvent.id}/registrations`}
                className="flex items-center justify-center gap-2 w-full h-9 border border-violet-200 text-violet-700 hover:bg-violet-50 rounded-xl text-sm font-medium transition-colors"
              >
                Lihat Peserta <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </Card>

        {/* At-Risk Members */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Perlu Diperhatikan</h2>
            <Link href="/members?status=at_risk" className="text-xs text-violet-600 hover:underline">Lihat semua</Link>
          </div>

          {!atRiskMembers?.length ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Semua member aktif 👍</p>
            </div>
          ) : (
            <div className="space-y-3">
              {atRiskMembers.map((m: any) => {
                const days = m.last_attended_at
                  ? Math.floor((Date.now() - new Date(m.last_attended_at).getTime()) / 86_400_000)
                  : null
                return (
                  <Link key={m.id} href={`/members/${m.id}`} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 -mx-1 px-1 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{m.phone}</p>
                    </div>
                    <span className="text-xs text-yellow-600 font-medium">
                      {days !== null ? `${days} hari lalu` : 'Belum pernah'}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Week Calendar */}
      <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-5">
        <WeekCalendar userId={user!.id} />
      </div>

      {/* Row 4: Stats Summary */}
      <StatsSummary userId={user!.id} />
    </DashboardLayout>
  )
}
