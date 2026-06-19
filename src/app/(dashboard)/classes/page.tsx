import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Users, Users2, Calendar, CheckSquare, TrendingUp,
  AlertTriangle, Clock, MapPin, Zap, MessageSquare, ChevronRight,
} from 'lucide-react'
import { getDayName, formatTime, formatDateShort, timeAgo } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'

const TYPE_EMOJI: Record<string, string> = {
  poundfit: '⚡', barre: '🩰', zumba: '💃',
  yoga: '🧘', pilates: '🏋️', aerobic: '🔥', other: '🎯',
}

export default async function BerandaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today    = new Date().toISOString().split('T')[0]
  const todayDow = new Date().getDay()
  const now      = new Date()
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  // Ambil semua data paralel
  const [
    profileRes,
    classesRes,
    membersRes,
    communityRes,
    todaySessionsRes,
    recentAttendanceRes,
    broadcastsRes,
    eventsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('name, business_name, slug').eq('id', user!.id).single(),
    supabase.from('classes').select('id, name, type, day_of_week, start_time, end_time, location, capacity').eq('user_id', user!.id).order('day_of_week').order('start_time'),
    supabase.from('members').select('id, name, status, last_attended_at').eq('user_id', user!.id),
    supabase.from('community_contacts').select('id, class_type').eq('user_id', user!.id),
    (supabase.from('sessions') as any)
      .select('id, class_id, session_type, override_location, attendance(id)')
      .eq('user_id', user!.id)
      .eq('session_date', today),
    supabase.from('attendance')
      .select('id, created_at, members(name), sessions!inner(session_date, class_id, classes(name))')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('broadcasts')
      .select('id, title, status, created_at')
      .eq('user_id', user!.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase.from('events')
      .select('id, title, event_date, start_time, location, status')
      .eq('user_id', user!.id)
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date')
      .limit(3),
  ])

  const profile    = profileRes.data
  const classes    = (classesRes.data ?? []) as any[]
  const members    = (membersRes.data ?? []) as any[]
  const community  = (communityRes.data ?? []) as any[]
  const todaySess  = (todaySessionsRes.data ?? []) as any[]
  const broadcasts = (broadcastsRes.data ?? []) as any[]
  const events     = (eventsRes.data ?? []) as any[]

  // Kelas hari ini
  const todayClasses = classes.filter(c => c.day_of_week === todayDow)
  const todaySessMap = new Map(todaySess.map((s: any) => [s.class_id, s]))

  // Statistik member
  const totalMembers  = members.length
  const activeMembers = members.filter(m => m.status === 'active').length
  const atRisk        = members.filter(m => m.status === 'at_risk').length

  // Total hadir hari ini
  const todayAttendCount = todaySess.reduce((sum: number, s: any) =>
    sum + (Array.isArray(s.attendance) ? s.attendance.length : 0), 0)

  // Salam berdasarkan jam
  const hour = now.getHours()
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
  const instructorName = profile?.name?.split(' ')[0] ?? 'Instruktur'

  return (
    <div className="w-full max-w-4xl">

      {/* ── Salam ── */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}, {instructorName}! 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Link href="/members" className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-violet-200 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xl font-bold text-gray-900">{totalMembers}</p>
            <Users className="w-5 h-5 text-violet-400" />
          </div>
          <p className="text-xs text-gray-400">Total Member</p>
          {atRisk > 0 && (
            <p className="text-[10px] text-orange-500 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {atRisk} perlu follow up
            </p>
          )}
        </Link>

        <Link href="/community" className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-violet-200 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xl font-bold text-gray-900">{community.length}</p>
            <Users2 className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-xs text-gray-400">Komunitas</p>
        </Link>

        <Link href="/classes" className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-violet-200 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xl font-bold text-violet-600">{todayClasses.length}</p>
            <Calendar className="w-5 h-5 text-violet-400" />
          </div>
          <p className="text-xs text-gray-400">Kelas Hari Ini</p>
          <p className="text-[10px] text-gray-300 mt-1">{classes.length} total kelas</p>
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xl font-bold text-green-600">{todayAttendCount}</p>
            <CheckSquare className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-xs text-gray-400">Hadir Hari Ini</p>
          <p className="text-[10px] text-gray-300 mt-1">{activeMembers} member aktif</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Kelas Hari Ini ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Kelas Hari Ini</h2>
            <Link href="/classes" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
              Semua <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {todayClasses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Tidak ada kelas hari ini</p>
              <p className="text-xs text-gray-300 mt-1">Nikmati hari liburmu! 😊</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayClasses.map(cls => {
                const sess        = todaySessMap.get(cls.id)
                const hadirCount  = sess ? (Array.isArray(sess.attendance) ? sess.attendance.length : 0) : 0
                const lokasi      = sess?.override_location ?? cls.location

                return (
                  <div key={cls.id} className="flex items-center justify-between p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{TYPE_EMOJI[cls.type] ?? '🎯'}</span>
                        <p className="text-sm font-semibold text-gray-900 truncate">{cls.name}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatTime(cls.start_time)}–{formatTime(cls.end_time)}
                        </p>
                        {lokasi && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />{lokasi}
                          </p>
                        )}
                      </div>
                      {hadirCount > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-0.5">{hadirCount} hadir</p>
                      )}
                    </div>
                    <Link
                      href={`/classes/${cls.id}/attendance?date=${today}`}
                      className="flex items-center gap-1 h-8 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0 ml-2"
                    >
                      <CheckSquare className="w-3 h-3" />
                      {hadirCount > 0 ? 'Lihat' : 'Absen'}
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Aktivitas Terkini ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Aktivitas Terkini</h2>
            <Link href="/members" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
              Member <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {!(recentAttendanceRes.data ?? []).length ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Belum ada aktivitas</p>
              <p className="text-xs text-gray-300 mt-1">Mulai absensi kelas pertama!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(recentAttendanceRes.data ?? []).slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <span className="text-green-600 font-semibold text-xs">
                      {(a.members?.name ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {a.members?.name ?? 'Peserta'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {(a.sessions as any)?.classes?.name ?? 'Kelas'} · {formatDateShort((a.sessions as any)?.session_date)}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-300 shrink-0">{timeAgo(a.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Member Perlu Follow Up ── */}
        {atRisk > 0 && (
          <div className="bg-white rounded-2xl border border-orange-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-bold text-gray-900">Perlu Follow Up</h2>
              </div>
              <Link href="/members?status=at_risk" className="text-xs text-orange-500 hover:underline flex items-center gap-0.5">
                Lihat semua <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {members.filter(m => m.status === 'at_risk').slice(0, 4).map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <span className="text-orange-600 font-semibold text-xs">{m.name[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{m.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {m.last_attended_at ? `Terakhir ${timeAgo(m.last_attended_at)}` : 'Belum pernah hadir'}
                      </p>
                    </div>
                  </div>
                  <Link href={`/members/${m.id}`} className="text-xs text-violet-600 hover:underline">
                    Detail
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Event Mendatang ── */}
        {events.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <h2 className="text-sm font-bold text-gray-900">Event Mendatang</h2>
              </div>
              <Link href="/events" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
                Semua <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {events.map(e => (
                <Link key={e.id} href={`/events/${e.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex flex-col items-center justify-center shrink-0">
                    <p className="text-[10px] text-yellow-600 font-bold leading-none">
                      {new Date(e.event_date).toLocaleDateString('id-ID', { month: 'short' }).toUpperCase()}
                    </p>
                    <p className="text-sm font-bold text-yellow-700 leading-none">
                      {new Date(e.event_date).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{e.title}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{e.location ?? 'Lokasi TBD'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Draft Broadcast ── */}
        {broadcasts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-bold text-gray-900">Draft Broadcast</h2>
              </div>
              <Link href="/broadcasts" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
                Semua <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {broadcasts.map(b => (
                <Link key={b.id} href={`/broadcasts`}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{b.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(b.created_at)}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium shrink-0 ml-2">
                    Draft
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Quick Actions ── */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Aksi Cepat</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/classes', label: 'Lihat Kelas', icon: Calendar, color: 'bg-violet-50 text-violet-600 border-violet-100' },
            { href: '/members', label: 'Tambah Member', icon: Users, color: 'bg-blue-50 text-blue-600 border-blue-100' },
            { href: '/broadcasts', label: 'Buat Broadcast', icon: MessageSquare, color: 'bg-green-50 text-green-600 border-green-100' },
            { href: '/events', label: 'Buat Event', icon: Zap, color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className={`flex items-center gap-2.5 p-3.5 rounded-2xl border ${a.color} hover:opacity-80 transition-opacity`}>
              <a.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
