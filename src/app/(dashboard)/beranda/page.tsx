import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import {
  CheckSquare, Clock, MapPin, Users, Zap,
  MessageSquare, AlertTriangle, CheckCircle,
  Calendar, TrendingUp, ChevronRight,
} from 'lucide-react'
import { formatTime, formatRupiah } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'
import { timed } from '@/lib/perf'

/**
 * Data dashboard yang TIDAK perlu real-time - profil, daftar kelas/event,
 * member at-risk, undangan komunitas pending, ringkasan bulan ini. Semua ini
 * berubah dalam hitungan menit/jam, bukan detik, jadi aman di-cache 45s per
 * user. "Hari Ini" (todaySessions/attendance count) TIDAK ikut di sini -
 * itu harus selalu fresh karena instruktur cek dashboard tepat setelah absen.
 *
 * Pakai service-role client (bukan client per-request) karena unstable_cache
 * bisa menyajikan hasil yang dihitung dari request/sesi lain - keamanan
 * dijaga manual lewat filter .eq('user_id', userId) di setiap query, bukan RLS.
 */
const getCachedBerandaData = unstable_cache(
  async (userId: string, today: string, monthStart: string) => {
    const supabase = createServiceClient()

    const [profileRes, classesRes, atRiskRes, eventsRes, invitationsPendingRes, summaryRes] = await Promise.all([
      timed('query:/beranda:profile', supabase.from('profiles')
        .select('name').eq('id', userId).single()),

      timed('query:/beranda:classes', supabase.from('classes')
        .select('id, name, type, day_of_week, start_time, end_time, location')
        .eq('user_id', userId)
        .order('start_time')),

      timed('query:/beranda:atRisk', supabase.from('members')
        .select('id, name, last_attended_at')
        .eq('user_id', userId)
        .eq('status', 'at_risk')),

      timed('query:/beranda:events', supabase.from('events')
        .select('id, title, event_date, start_time, location')
        .eq('user_id', userId)
        .eq('status', 'published')
        .gte('event_date', today)
        .order('event_date')
        .limit(2)),

      timed<any>('query:/beranda:invitationsPending', (supabase.from('community_invitation_candidates') as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending')),

      timed<any>('query:/beranda:summary', (supabase.rpc as any)('get_dashboard_summary', {
        p_user_id:     userId,
        p_month_start: monthStart,
      })),
    ])

    return {
      instructorName:      profileRes.data?.name ?? null,
      classes:             (classesRes.data ?? []) as any[],
      atRiskMembers:       (atRiskRes.data ?? []) as any[],
      events:              (eventsRes.data ?? []) as any[],
      invitationsPending:  invitationsPendingRes.count ?? 0,
      summary:             (summaryRes.data ?? {}) as any,
    }
  },
  ['beranda-cached-data'],
  { revalidate: 45 }
)

const TYPE_EMOJI: Record<string, string> = {
  poundfit: '⚡', barre: '🩰', zumba: '💃',
  yoga: '🧘', pilates: '🏋️', aerobic: '🔥', other: '🎯',
}

// WIB helper — server Vercel pakai UTC
function getNowWIB() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return {
    today:      wib.toISOString().split('T')[0],
    todayDow:   wib.getUTCDay(),
    hour:       wib.getUTCHours(),
    monthStart: wib.toISOString().substring(0, 7) + '-01',
    dateLabel:  wib.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }),
  }
}

export default async function BerandaPage() {
  console.time('page:/beranda')
  const supabase = await createClient()
  // getSession() baca dari cookie (lokal, tanpa network call) - aman dipakai di sini
  // karena middleware sudah memvalidasi sesi via getUser() (network call) untuk request ini.
  // RLS tetap melindungi data terlepas dari nilai user.id yang dipakai di query.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  const { today, todayDow, hour, monthStart, dateLabel } = getNowWIB()

  const greeting = hour < 11 ? 'Selamat pagi'
    : hour < 15 ? 'Selamat siang'
    : hour < 18 ? 'Selamat sore'
    : 'Selamat malam'

  console.time('query:/beranda:all')
  const [cached, todaySessionsRes] = await Promise.all([
    // Bundel yang di-cache 45s per user - lihat getCachedBerandaData di atas
    timed('query:/beranda:cached-bundle', getCachedBerandaData(user!.id, today, monthStart)),

    // Sesi hari ini + jumlah hadir - SELALU fresh, jangan di-cache
    // (instruktur cek dashboard tepat setelah absen, harus langsung update)
    timed<any>('query:/beranda:todaySessions', (supabase.from('sessions') as any)
      .select('id, class_id, override_location, attendance(id)')
      .eq('user_id', user!.id)
      .eq('session_date', today)),
  ])
  console.timeEnd('query:/beranda:all')

  const instructorName = cached.instructorName?.split(' ')[0] ?? 'Instruktur'
  const classes        = cached.classes
  const todaySessions  = (todaySessionsRes.data ?? []) as any[]
  const atRiskMembers  = cached.atRiskMembers
  const events         = cached.events
  const invitationsPending = cached.invitationsPending
  const summary         = cached.summary
  const attendMonth     = summary.attendance_month ?? 0
  const memberNew       = summary.member_new ?? 0
  const revenueMonth    = Number(summary.revenue_month ?? 0)
  const pendingEvents   = (summary.pending_events ?? []) as { id: string; title: string; count: number }[]

  // Kelas hari ini
  const todayClasses  = classes.filter(c => c.day_of_week === todayDow)
  const sessMap       = new Map(todaySessions.map((s: any) => [s.class_id, s]))

  const hasAttention = atRiskMembers.length > 0 || pendingEvents.length > 0 || invitationsPending > 0

  console.timeEnd('page:/beranda')

  return (
    <div className="w-full max-w-lg mx-auto">

      {/* ── Salam ── */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}, {instructorName}! 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5 capitalize">{dateLabel}</p>
      </div>

      {/* ── HARI INI ── */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Hari Ini</p>

        {/* Kelas hari ini */}
        {todayClasses.length === 0 && events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center">
            <p className="text-sm text-gray-400">Tidak ada kelas atau event hari ini</p>
            <p className="text-xs text-gray-300 mt-1">Nikmati hari libur! 😊</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayClasses.map(cls => {
              const sess       = sessMap.get(cls.id)
              const hadirCount = sess ? (sess.attendance?.length ?? 0) : 0
              const lokasi     = sess?.override_location ?? cls.location

              return (
                <div key={cls.id}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-violet-100 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{TYPE_EMOJI[cls.type] ?? '🎯'}</span>
                      <p className="text-sm font-bold text-gray-900 truncate">{cls.name}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{formatTime(cls.start_time)}–{formatTime(cls.end_time)}
                      </p>
                      {lokasi && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />{lokasi}
                        </p>
                      )}
                      {hadirCount > 0 && (
                        <p className="text-xs text-green-600 font-semibold">{hadirCount} hadir</p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/classes/${cls.id}/attendance?date=${today}`}
                    className="flex items-center gap-1 h-8 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
                  >
                    <CheckSquare className="w-3 h-3" />
                    {hadirCount > 0 ? 'Lihat' : 'Absen'}
                  </Link>
                </div>
              )
            })}

            {/* Event terdekat */}
            {events.map(ev => {
              const isToday = ev.event_date === today
              return (
                <Link key={ev.id} href={`/events/${ev.id}`}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-yellow-100 px-4 py-3 hover:border-yellow-200 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-yellow-50 flex flex-col items-center justify-center shrink-0">
                    <p className="text-[9px] font-bold text-yellow-600 leading-none uppercase">
                      {new Date(ev.event_date + 'T00:00').toLocaleDateString('id-ID', { month: 'short' })}
                    </p>
                    <p className="text-sm font-bold text-yellow-700 leading-tight">
                      {new Date(ev.event_date + 'T00:00').getDate()}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{ev.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      {isToday ? 'Hari ini' : 'Mendatang'}
                      {ev.location && <> · {ev.location}</>}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── AKSI CEPAT ── */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Aksi Cepat</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: todayClasses.length > 0 ? `/classes/${todayClasses[0].id}/attendance?date=${today}` : '/classes',
              label: 'Absen', icon: CheckSquare, color: 'bg-violet-600 text-white' },
            { href: '/members/new',  label: '+ Member',   icon: Users,         color: 'bg-white border border-gray-200 text-gray-700' },
            { href: '/events/new',   label: '+ Event',    icon: Zap,           color: 'bg-white border border-gray-200 text-gray-700' },
            { href: '/broadcasts',   label: 'Broadcast',  icon: MessageSquare, color: 'bg-white border border-gray-200 text-gray-700' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-semibold transition-colors ${a.color}`}>
              <a.icon className="w-5 h-5" />
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── PERLU PERHATIAN — selalu tampil ── */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Perlu Perhatian</p>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {!hasAttention ? (
            <div className="flex items-center gap-3 px-4 py-4">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <p className="text-sm text-gray-500">Semua beres, tidak ada yang perlu ditindaklanjuti 🎉</p>
            </div>
          ) : (
            <>
              {pendingEvents.map(pe => (
                <Link key={pe.id} href="/events"
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {pe.count} peserta menunggu konfirmasi
                    </p>
                    <p className="text-xs text-gray-400 truncate">{pe.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              ))}
              {atRiskMembers.length > 0 && (
                <Link href="/members"
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {atRiskMembers.length} member tidak aktif 30+ hari
                    </p>
                    <p className="text-xs text-gray-400">
                      {atRiskMembers.slice(0, 2).map(m => m.name).join(', ')}
                      {atRiskMembers.length > 2 && ` +${atRiskMembers.length - 2} lainnya`}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              )}
              {invitationsPending > 0 && (
                <Link href="/community/invitations"
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {invitationsPending} peserta belum bergabung komunitas
                    </p>
                    <p className="text-xs text-gray-400">Undang ke grup WhatsApp</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── BULAN INI ── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bulan Ini</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Kehadiran',  value: attendMonth,              unit: 'orang', icon: CheckSquare, color: 'text-violet-600' },
            { label: 'Member Baru', value: memberNew,               unit: 'orang', icon: Users,       color: 'text-blue-600'   },
            { label: 'Revenue',    value: formatRupiah(revenueMonth), unit: '',    icon: TrendingUp,  color: 'text-green-600'  },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 px-3 py-3.5 text-center">
              <k.icon className={`w-4 h-4 mx-auto mb-1.5 ${k.color}`} />
              <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
              {k.unit && <p className="text-[10px] text-gray-400">{k.unit}</p>}
              <p className="text-[10px] text-gray-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
