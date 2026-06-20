import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, BookOpen } from 'lucide-react'
import { CLASS_TYPES } from '@/lib/constants'
import { ClassCard } from '@/components/classes/ClassCard'
import { ClassesFilter } from '@/components/classes/ClassesFilter'
import { timed } from '@/lib/perf'

export default async function ClassesPage() {
  console.time('page:/classes')
  const supabase = await createClient()
  // getSession() baca dari cookie (tanpa network call) - middleware sudah validasi sesi
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  // Gunakan WIB (UTC+7) agar hari sesuai timezone instruktur
  const nowWIB   = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const today    = nowWIB.toISOString().split('T')[0]
  const todayDow = nowWIB.getUTCDay()
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  console.time('query:/classes:all')
  const [classesRes, todaySessionsRes] = await Promise.all([
    timed('query:/classes:classes', supabase
      .from('classes')
      .select('id, name, type, day_of_week, start_time, end_time, location, capacity, class_price')
      .eq('user_id', user!.id)
      .order('day_of_week')
      .order('start_time')),

    timed<any>('query:/classes:todaySessions', (supabase.from('sessions') as any)
      .select('id, class_id, attendance(id)')
      .eq('user_id', user!.id)
      .eq('session_date', today)),
  ])
  console.timeEnd('query:/classes:all')

  const classes: any[]      = classesRes.data ?? []
  const todaySessions: any[] = todaySessionsRes.data ?? []

  // Map class_id → jumlah hadir hari ini
  const attendTodayMap: Record<string, number> = {}
  todaySessions.forEach((s: any) => {
    attendTodayMap[s.class_id] = Array.isArray(s.attendance) ? s.attendance.length : 0
  })

  // Pisah: kelas hari ini vs kelas lain
  const todayClasses = classes.filter(c => c.day_of_week === todayDow)
  const otherClasses = classes.filter(c => c.day_of_week !== todayDow)

  // Urutkan otherClasses: mulai dari hari berikutnya (wrap sekitar minggu)
  const ordered = [
    ...Array.from({ length: 7 }, (_, i) => (todayDow + 1 + i) % 7)
      .flatMap(d => otherClasses.filter(c => c.day_of_week === d))
  ]

  // Jenis kelas unik yang dimiliki instruktur (untuk filter)
  const usedTypes = CLASS_TYPES.filter(t => classes.some(c => c.type === t.value))

  console.timeEnd('page:/classes')

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kelas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{classes.length} kelas aktif</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/classes/extra"
            className="flex items-center gap-1.5 h-9 px-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Kelas Ekstra</span>
          </Link>
          <Link
            href="/classes/new"
            className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </Link>
        </div>
      </div>

      {/* Filter — client component agar tidak reload page */}
      {usedTypes.length > 1 && (
        <ClassesFilter
          types={usedTypes}
          todayClasses={todayClasses}
          otherClasses={ordered}
          attendTodayMap={attendTodayMap}
          today={today}
          todayDow={todayDow}
          typeLabel={typeLabel}
        />
      )}

      {/* Kalau tidak ada filter (1 jenis kelas) — render langsung */}
      {usedTypes.length <= 1 && (
        <ClassList
          todayClasses={todayClasses}
          otherClasses={ordered}
          attendTodayMap={attendTodayMap}
          today={today}
          todayDow={todayDow}
          typeLabel={typeLabel}
          allClasses={classes}
        />
      )}

    </div>
  )
}

// ─── ClassList helper (server) ────────────────────────────────────────────────

function ClassList({
  todayClasses, otherClasses, attendTodayMap, today, typeLabel,
}: {
  todayClasses: any[]; otherClasses: any[]; attendTodayMap: Record<string, number>
  today: string; todayDow: number; typeLabel: Record<string, string>; allClasses: any[]
}) {
  if (todayClasses.length === 0 && otherClasses.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🎯</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">Belum ada kelas</p>
        <p className="text-xs text-gray-400 mb-5">Tambahkan jadwal kelas pertama kamu</p>
        <Link
          href="/classes/new"
          className="inline-flex items-center gap-1.5 h-9 px-5 bg-violet-600 text-white rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Tambah Kelas
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Kelas hari ini */}
      {todayClasses.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-3">
            Hari Ini
          </p>
          <div className="space-y-3">
            {todayClasses.map(cls => (
              <ClassCard
                key={cls.id}
                cls={cls}
                isToday={true}
                attendCount={attendTodayMap[cls.id] ?? 0}
                sessionDate={today}
                typeLabel={typeLabel}
              />
            ))}
          </div>
        </section>
      )}

      {/* Kelas lainnya */}
      {otherClasses.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Jadwal Lainnya
          </p>
          <div className="space-y-3">
            {otherClasses.map(cls => (
              <ClassCard
                key={cls.id}
                cls={cls}
                isToday={false}
                attendCount={0}
                typeLabel={typeLabel}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
