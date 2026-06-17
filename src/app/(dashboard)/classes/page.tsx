import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Clock, MapPin, CheckSquare, ChevronRight, Sparkles, AlertTriangle, Heart } from 'lucide-react'
import { getDayName, formatTime, formatDateShort } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today    = new Date().toISOString().split('T')[0]
  const todayDow = new Date().getDay()
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  const [classesRes, todaySessionsRes] = await Promise.all([
    supabase.from('classes').select('*').eq('user_id', user!.id).order('day_of_week').order('start_time'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('sessions') as any)
      .select('id, class_id, session_type, notified_at, override_location')
      .eq('user_id', user!.id)
      .eq('session_date', today),
  ])

  const classes      = classesRes.data ?? []
  const todaySessions: any[] = todaySessionsRes.data ?? []

  // Build map: class_id → today's session info
  const todayMap = new Map<string, any>()
  todaySessions.forEach((s: any) => todayMap.set(s.class_id, s))

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Kelas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{classes.length} kelas terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/classes/benefits"
            className="flex items-center gap-1.5 h-9 px-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors"
          >
            <Heart className="w-4 h-4" />
            Manfaat Kelas
          </Link>
          <Link
            href="/classes/extra"
            className="flex items-center gap-1.5 h-9 px-3 border border-violet-200 text-violet-600 hover:bg-violet-50 rounded-xl text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Kelas Ekstra
          </Link>
          <Link
            href="/classes/new"
            className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Kelas
          </Link>
        </div>
      </div>

      {!classes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Belum ada kelas</p>
          <p className="text-xs text-gray-400 mb-4">Tambahkan jadwal kelas pertama kamu</p>
          <Link href="/classes/new" className="text-sm text-violet-600 font-medium hover:underline">
            + Tambah kelas
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((cls: any) => {
            const isToday = cls.day_of_week === todayDow
            const todaySess = todayMap.get(cls.id)
            const sessType  = todaySess?.session_type
            const sessBadge = sessType && SESSION_BADGE[sessType] ? SESSION_BADGE[sessType] : null
            const unnotified = todaySess && sessType !== 'regular' && !todaySess.notified_at

            return (
              <div
                key={cls.id}
                className={`bg-white rounded-2xl border p-4 transition-colors ${
                  isToday ? 'border-violet-200 bg-violet-50/30' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-xs font-bold ${
                    isToday ? 'bg-violet-600 text-white' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {getDayName(cls.day_of_week).substring(0, 3)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/classes/${cls.id}`} className="text-sm font-semibold text-gray-900 hover:text-violet-700">
                        {cls.name}
                      </Link>
                      <Badge color={TYPE_COLOR[cls.type] ?? 'gray'}>
                        {typeLabel[cls.type] ?? cls.type}
                      </Badge>
                      {isToday && <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Hari Ini</span>}
                      {sessBadge && <Badge color={sessBadge.color}>{sessBadge.label}</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      {(todaySess?.override_location || cls.location) && (
                        <>
                          <MapPin className="w-3 h-3 ml-1" />
                          {todaySess?.override_location ?? cls.location}
                        </>
                      )}
                      {cls.capacity && <span className="ml-1">· Kapasitas {cls.capacity}</span>}
                    </p>

                    {/* Unnotified warning */}
                    {unnotified && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />
                        <span className="text-xs text-orange-600">Member belum diinfokan perubahan ini</span>
                        <Link href="/broadcasts" className="text-xs text-orange-600 font-semibold underline ml-1">Kirim Info</Link>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isToday && todaySess && (
                      <Link
                        href={`/classes/${cls.id}/sessions/${todaySess.id}`}
                        className="flex items-center gap-1 h-8 px-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                      >
                        Kelola
                      </Link>
                    )}
                    {isToday && (
                      <Link
                        href={`/classes/${cls.id}/attendance?date=${today}`}
                        className="flex items-center gap-1 h-8 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Absen
                      </Link>
                    )}
                    <Link href={`/classes/${cls.id}`} className="text-gray-300 hover:text-gray-500">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
