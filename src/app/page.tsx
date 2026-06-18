import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/card'
import { AlertTriangle, MessageCircle, CheckCircle } from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { StatsSummary } from '@/components/dashboard/StatsSummary'
import { WeekCalendar } from '@/components/dashboard/WeekCalendar'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { ConfirmPaymentButton } from '@/components/dashboard/ConfirmPaymentButton'
import { ApproveTestimonialButton } from '@/components/dashboard/ApproveTestimonialButton'
import { AutoFillSessions } from '@/components/dashboard/AutoFillSessions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today    = new Date().toISOString().split('T')[0]
  const todayDOW = new Date().getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  // Monday of this week
  const now  = new Date()
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    .toISOString().split('T')[0]

  const [
    { count: totalMembers },
    { count: activeMembers },
    { count: weekSessions },
    profileRes,
    todayClassesRes,
    todaySessionsRes,
    pendingEventRes,
    pendingClassRes,
    pendingTestimonialsRes,
    atRiskRes,
    changedSessionsRes,
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active'),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('session_date', weekStart),
    supabase.from('profiles').select('name').eq('id', user.id).single(),
    // Classes scheduled today (by day_of_week)
    supabase
      .from('classes')
      .select('id, name, start_time, location')
      .eq('user_id', user.id)
      .eq('day_of_week', todayDOW)
      .eq('is_active', true)
      .order('start_time'),
    // Sessions that exist for today (to get attended_count)
    supabase
      .from('today_sessions')
      .select('class_id, attended_count')
      .eq('user_id', user.id)
      .eq('session_date', today),
    // Pending event payments
    supabase
      .from('registrations')
      .select('id, event_id, registrant_name, amount_paid, events!inner(title, user_id)')
      .eq('events.user_id', user.id)
      .eq('payment_status', 'pending')
      .order('registered_at', { ascending: false })
      .limit(3),
    // Pending class payments
    supabase
      .from('registrations')
      .select('id, class_id, registrant_name, amount_paid, classes!inner(name, user_id)')
      .eq('classes.user_id', user.id)
      .eq('payment_status', 'pending')
      .order('registered_at', { ascending: false })
      .limit(3),
    // Testimoni menunggu approval
    supabase
      .from('testimonials')
      .select('id, name, content, rating')
      .eq('user_id', user.id)
      .eq('is_published', false)
      .order('created_at', { ascending: false })
      .limit(3),
    // At-risk members
    supabase
      .from('members')
      .select('id, name, phone, last_attended_at')
      .eq('user_id', user.id)
      .eq('status', 'at_risk')
      .order('last_attended_at', { ascending: true })
      .limit(3),
    // Today sessions with unnotified changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('sessions') as any)
      .select('id, class_id, session_type, classes(name)')
      .eq('user_id', user.id)
      .eq('session_date', today)
      .neq('session_type', 'regular')
      .is('notified_at', null),
  ])

  const instructorName      = profileRes.data?.name ?? 'Instruktur'
  const todayClasses        = (todayClassesRes.data        as any[]) ?? []
  const todaySessions       = (todaySessionsRes.data       as any[]) ?? []
  const pendingEventRegs    = (pendingEventRes.data         as any[]) ?? []
  const pendingClassRegs    = (pendingClassRes.data         as any[]) ?? []
  const pendingTestimonials = (pendingTestimonialsRes.data  as any[]) ?? []
  const atRiskMembers       = (atRiskRes.data               as any[]) ?? []
  const changedSessions     = (changedSessionsRes.data      as any[]) ?? []

  // Gabungkan pembayaran event + kelas pending jadi satu list konsisten
  const pendingPayments = [
    ...pendingEventRegs.map((r: any) => ({
      id: r.id, name: r.registrant_name, amount: r.amount_paid,
      title: (r.events as any)?.title, link: `/events/${r.event_id}/registrations`,
    })),
    ...pendingClassRegs.map((r: any) => ({
      id: r.id, name: r.registrant_name, amount: r.amount_paid,
      title: (r.classes as any)?.name, link: `/classes/${r.class_id}/registrations`,
    })),
  ]

  // Merge today's classes with their session info
  const todaySchedule = todayClasses.map((cls: any) => {
    const sess = todaySessions.find((s: any) => s.class_id === cls.id)
    return {
      class_id:      cls.id,
      class_name:    cls.name,
      start_time:    cls.start_time,
      location:      cls.location,
      attended_count: sess?.attended_count ?? 0,
    }
  })

  const allDone         = todaySchedule.length > 0 && todaySchedule.every(s => s.attended_count > 0)
  const hasPendingItems = pendingPayments.length > 0 || atRiskMembers.length > 0 || pendingTestimonials.length > 0

  return (
    <DashboardLayout>
      <AutoFillSessions />
      {/* Greeting */}
      <DashboardGreeting name={instructorName} />

      {/* 2 Stat Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href="/members?status=active">
          <Card className="p-4 hover:shadow-md hover:border-violet-100 transition-all cursor-pointer">
            <p className="text-2xl font-bold text-gray-900">{activeMembers ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">dari {totalMembers ?? 0} total</p>
            <p className="text-xs font-semibold text-violet-600 mt-1.5">👥 Member Aktif</p>
          </Card>
        </Link>
        <Link href="/classes">
          <Card className="p-4 hover:shadow-md hover:border-violet-100 transition-all cursor-pointer">
            <p className="text-2xl font-bold text-gray-900">{weekSessions ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">sesi minggu ini</p>
            <p className="text-xs font-semibold text-violet-600 mt-1.5">📅 Kelas Minggu Ini</p>
          </Card>
        </Link>
      </div>

      {/* ── AKSI HARI INI - always shown ── */}
      {todaySchedule.length === 0 ? (
        <div className="mb-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 text-center">
          <p className="text-base font-medium text-gray-600">Tidak ada kelas hari ini 🎉</p>
          <p className="text-sm text-gray-400 mt-1">Nikmati harimu, {instructorName}!</p>
          <p className="text-xs text-gray-400 mt-1">{formatDate(new Date())}</p>
        </div>
      ) : allDone ? (
        <div className="mb-4 p-5 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
          <CheckCircle className="w-9 h-9 text-green-500 shrink-0" />
          <div>
            <p className="text-base font-semibold text-green-800">Semua absensi hari ini sudah selesai ✓</p>
            <p className="text-sm text-green-600 mt-0.5">{todaySchedule.length} kelas terlaksana</p>
          </div>
        </div>
      ) : (
        <Card className="mb-4 bg-gradient-to-br from-violet-50 to-white border-violet-100">
          <p className="text-xs font-bold text-violet-500 uppercase tracking-widest mb-4">Aksi Hari Ini</p>
          <div className="space-y-3">
            {todaySchedule.map((s) => {
              const done = s.attended_count > 0
              return (
                <div key={s.class_id} className={`rounded-xl p-4 ${done ? 'bg-green-50/70' : 'bg-white border border-violet-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900 truncate">{s.class_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {String(s.start_time).substring(0, 5)}
                        {s.location && ` · ${s.location}`}
                      </p>
                    </div>
                    {done ? (
                      <span className="text-sm text-green-600 font-semibold shrink-0">✓ {s.attended_count} hadir</span>
                    ) : (
                      <Link
                        href={`/classes/${s.class_id}/attendance?date=${today}`}
                        className="flex items-center justify-center h-12 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors shrink-0 shadow-sm"
                      >
                        ✓ Mulai Absensi
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── PERUBAHAN BELUM DINOTIF ── */}
      {changedSessions.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-800">Ada perubahan yang belum diinfokan ke member</p>
              <div className="mt-1.5 space-y-1">
                {changedSessions.map((s: any) => {
                  const TYPE_LABEL: Record<string, string> = {
                    rescheduled: 'Dijadwal Ulang', extra: 'Kelas Ekstra', location_changed: 'Lokasi Berubah',
                  }
                  return (
                    <p key={s.id} className="text-xs text-orange-700">
                      • {(s.classes as any)?.name} - {TYPE_LABEL[s.session_type] ?? s.session_type}
                    </p>
                  )
                })}
              </div>
            </div>
            <Link
              href="/broadcasts"
              className="shrink-0 text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Kirim Info
            </Link>
          </div>
        </div>
      )}

      {/* ── PERLU TINDAKAN - only when there are items ── */}
      {hasPendingItems && (
        <Card className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900">Perlu Tindakan Sekarang</h2>
          </div>
          <div className="space-y-1">
            {pendingPayments.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    💳 {r.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.title} · {formatRupiah(Number(r.amount ?? 0))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={r.link}
                    className="h-8 px-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs transition-colors flex items-center"
                  >
                    Bukti
                  </Link>
                  <ConfirmPaymentButton registrationId={r.id} />
                </div>
              </div>
            ))}

            {pendingTestimonials.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    💬 {t.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    Testimoni baru · &ldquo;{t.content}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href="/settings?tab=testimoni"
                    className="h-8 px-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs transition-colors flex items-center"
                  >
                    Lihat
                  </Link>
                  <ApproveTestimonialButton testimonialId={t.id} />
                </div>
              </div>
            ))}

            {atRiskMembers.map((m: any) => {
              const days = m.last_attended_at
                ? Math.floor((Date.now() - new Date(m.last_attended_at).getTime()) / 86_400_000)
                : null
              const digits  = (m.phone ?? '').replace(/\D/g, '')
              const waNum   = digits.startsWith('0') ? '62' + digits.slice(1) : digits.startsWith('62') ? digits : '62' + digits
              const msg     = `Halo ${m.name}! Sudah ${days ?? 'lama'} hari nih kamu belum hadir kelas. Kapan mau balik? 😊`
              const wa      = digits ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}` : null
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      ⚠️ {m.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Belum hadir {days !== null ? `${days} hari` : 'cukup lama'}
                    </p>
                  </div>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 h-8 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Kirim WA
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── KALENDER MINGGUAN ── */}
      <div className="mb-4 bg-white rounded-2xl border border-gray-100 p-4">
        <WeekCalendar userId={user.id} />
      </div>

      {/* ── RINGKASAN STATISTIK ── */}
      <StatsSummary userId={user.id} />
    </DashboardLayout>
  )
}
