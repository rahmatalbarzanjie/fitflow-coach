import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Clock, MapPin, CheckSquare, ChevronRight, AlertTriangle, Calendar, Users } from 'lucide-react'
import { getDayName, formatTime, formatRupiah } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { AddClassModal } from '@/components/classes/AddClassModal'
import { ClassRowActions } from '@/components/classes/ClassRowActions'

const TYPE_COLOR: Record<string, 'violet' | 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'gray'> = {
  zumba: 'violet', yoga: 'green', pilates: 'blue',
  poundfit: 'orange', aerobic: 'red', barre: 'yellow', other: 'gray',
}

const SESSION_BADGE: Record<string, { label: string; color: 'orange' | 'green' | 'blue' }> = {
  rescheduled:      { label: 'Dijadwal Ulang', color: 'orange' },
  extra:            { label: 'Ekstra',          color: 'green'  },
  location_changed: { label: 'Lokasi Baru',     color: 'blue'   },
}

export default async function ClassesPage() {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today    = new Date().toISOString().split('T')[0]
  const todayDow = new Date().getDay()
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  const [classesRes, todaySessionsRes, attendanceRes, benefitsRes] = await Promise.all([
    supabase.from('classes').select('*').eq('user_id', user!.id).order('day_of_week').order('start_time'),
    (supabase.from('sessions') as any)
      .select('id, class_id, session_type, notified_at, override_location')
      .eq('user_id', user!.id).eq('session_date', today),
    supabase.from('attendance').select('session_id, sessions!inner(class_id)').eq('user_id', user!.id),
    supabase.from('class_type_benefits').select('type, benefits').eq('user_id', user!.id),
  ])

  const classes: any[]       = classesRes.data ?? []
  const todaySessions: any[] = todaySessionsRes.data ?? []
  const benefits: any[]      = benefitsRes.data ?? []

  const todayMap = new Map<string, any>()
  todaySessions.forEach((s: any) => todayMap.set(s.class_id, s))

  const attendMap: Record<string, number> = {}
  ;((attendanceRes.data ?? []) as any[]).forEach((a: any) => {
    const cid = a.sessions?.class_id
    if (cid) attendMap[cid] = (attendMap[cid] ?? 0) + 1
  })

  const usedTypes  = Array.from(new Set(classes.map((c: any) => c.type)))
  const typeCount  = Object.fromEntries(CLASS_TYPES.map(t => [t.value, classes.filter((c: any) => c.type === t.value).length]))
  const todayCount = classes.filter((c: any) => c.day_of_week === todayDow).length

  // Benefits per type — untuk dikirim ke ClassRowActions
  const benefitsMap = Object.fromEntries(benefits.map((b: any) => [b.type, b.benefits ?? '']))

  return (
    <div className="w-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Kelas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{classes.length} kelas terdaftar</p>
        </div>
        <AddClassModal />
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Kelas</p>
        </div>
        <div className="bg-white rounded-2xl border border-violet-100 p-4">
          <p className="text-2xl font-bold text-violet-600">{todayCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Kelas Hari Ini</p>
        </div>
        {CLASS_TYPES.filter(t => typeCount[t.value] > 0).slice(0, 2).map(t => (
          <div key={t.value} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-700">{typeCount[t.value]}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabel ── */}
      {!classes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Belum ada kelas</p>
          <p className="text-xs text-gray-400">Tambahkan jadwal kelas pertama kamu</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              {todayCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full text-[10px] font-medium mr-2">
                  <Calendar className="w-3 h-3" /> {todayCount} kelas hari ini
                </span>
              )}
              {classes.length} kelas total
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kelas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Jadwal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Lokasi</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kapasitas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Harga</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Total Hadir</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {classes.map((cls: any) => {
                  const isToday   = cls.day_of_week === todayDow
                  const todaySess = todayMap.get(cls.id)
                  const sessType  = todaySess?.session_type
                  const sessBadge = sessType && SESSION_BADGE[sessType] ? SESSION_BADGE[sessType] : null
                  const unnotified = todaySess && sessType !== 'regular' && !todaySess.notified_at

                  // Benefits untuk kelas ini (per type)
                  const classBenefits = usedTypes.map(type => ({
                    type,
                    label: typeLabel[type] ?? type,
                    initialBenefits: benefitsMap[type] ?? '',
                    userId: user!.id,
                  }))

                  return (
                    <tr key={cls.id} className={`transition-colors ${isToday ? 'bg-violet-50/40' : 'hover:bg-gray-50'}`}>
                      {/* Nama & tipe */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isToday && <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-medium">Hari Ini</span>}
                          <Link href={`/classes/${cls.id}`} className="font-semibold text-gray-900 hover:text-violet-700 text-sm">
                            {cls.name}
                          </Link>
                          <Badge color={TYPE_COLOR[cls.type] ?? 'gray'}>{typeLabel[cls.type] ?? cls.type}</Badge>
                          {sessBadge && <Badge color={sessBadge.color}>{sessBadge.label}</Badge>}
                        </div>
                        {unnotified && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 text-orange-500" />
                            <span className="text-[10px] text-orange-600">Member belum diinfokan</span>
                            <Link href="/broadcasts" className="text-[10px] text-orange-600 font-semibold underline">Kirim Info</Link>
                          </div>
                        )}
                      </td>

                      {/* Jadwal */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isToday ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {getDayName(cls.day_of_week).substring(0, 3)}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-700">{getDayName(cls.day_of_week)}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{formatTime(cls.start_time)}–{formatTime(cls.end_time)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Lokasi */}
                      <td className="px-4 py-3">
                        {(todaySess?.override_location || cls.location) ? (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-300" />{todaySess?.override_location ?? cls.location}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>

                      {/* Kapasitas */}
                      <td className="px-4 py-3">
                        {cls.capacity ? (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-300" />{cls.capacity} orang
                          </span>
                        ) : <span className="text-xs text-gray-300">Bebas</span>}
                      </td>

                      {/* Harga */}
                      <td className="px-4 py-3">
                        {cls.class_price > 0
                          ? <span className="text-xs font-medium text-gray-700">{formatRupiah(cls.class_price)}</span>
                          : <span className="text-xs text-green-600 font-medium">Gratis</span>}
                      </td>

                      {/* Total hadir */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-gray-700">{attendMap[cls.id] ?? 0}</span>
                        <span className="text-xs text-gray-400 ml-1">sesi</span>
                      </td>

                      {/* Aksi */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {isToday && (
                            <Link href={`/classes/${cls.id}/attendance?date=${today}`}
                              className="flex items-center gap-1 h-7 px-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors">
                              <CheckSquare className="w-3 h-3" /> Absen
                            </Link>
                          )}
                          <Link href={`/classes/${cls.id}`}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          <ClassRowActions
                            cls={cls}
                            benefits={classBenefits}
                            allClasses={classes}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
