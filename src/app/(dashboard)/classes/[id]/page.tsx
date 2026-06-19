import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { getDayName, formatTime } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'
import {
  Users, CheckSquare, CalendarDays, BarChart2,
  Settings, MapPin, Clock,
} from 'lucide-react'

const TYPE_EMOJI: Record<string, string> = {
  poundfit: '⚡', barre: '🩰', zumba: '💃',
  yoga: '🧘', pilates: '🏋️', aerobic: '🔥', other: '🎯',
}

// Konversi ke WIB (UTC+7)
function getTodayWIB(): string {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return wib.toISOString().split('T')[0]
}

function getThisMonthWIB(): string {
  return getTodayWIB().substring(0, 7)
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today      = getTodayWIB()
  const thisMonth  = getThisMonthWIB()
  const monthStart = `${thisMonth}-01`
  const monthEnd   = `${thisMonth}-31`

  const [clsRes, todaySessionRes, upcomingRes, monthlyRes, pesertaRes] = await Promise.all([
    supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single(),

    // Sesi hari ini (WIB)
    (supabase.from('sessions') as any)
      .select('id, attendance(id)')
      .eq('class_id', id)
      .eq('session_date', today)
      .maybeSingle(),

    // Sesi mendatang
    (supabase.from('sessions') as any)
      .select('id')
      .eq('class_id', id)
      .gte('session_date', today)
      .order('session_date'),

    // Total kehadiran bulan ini
    (supabase.from('sessions') as any)
      .select('id, attendance(id)')
      .eq('class_id', id)
      .gte('session_date', monthStart)
      .lte('session_date', monthEnd),

    // Jumlah peserta terdaftar (confirmed)
    (supabase.from('registrations') as any)
      .select('id')
      .eq('class_id', id)
      .eq('payment_status', 'confirmed'),
  ])

  const { data: cls } = clsRes
  if (!cls) notFound()

  const typeLabel     = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))
  const emoji         = TYPE_EMOJI[cls.type] ?? '🎯'
  const label         = typeLabel[cls.type] ?? cls.type
  const todaySession  = todaySessionRes.data
  const todayHadir    = todaySession
    ? (Array.isArray(todaySession.attendance) ? todaySession.attendance.length : 0)
    : 0
  const upcomingCount = (upcomingRes.data ?? []).length

  // Hitung total hadir bulan ini dari semua sesi bulan ini
  const monthlyHadir = (monthlyRes.data ?? []).reduce((sum: number, s: any) =>
    sum + (Array.isArray(s.attendance) ? s.attendance.length : 0), 0)

  const pesertaCount  = (pesertaRes.data ?? []).length

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref="/classes"
        title={`${emoji} ${cls.name}`}
        subtitle={`${label} · ${getDayName(cls.day_of_week)}`}
      />

      {/* Info singkat kelas */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-4 space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4 text-gray-400 shrink-0" />
          <span>{formatTime(cls.start_time)} – {formatTime(cls.end_time)}</span>
        </div>
        {cls.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{cls.location}</span>
          </div>
        )}
      </div>

      {/* Section: Operasional */}
      <SectionList label="Operasional">
        <DetailRow
          icon={<Users className="w-4 h-4" />}
          label="Peserta"
          sublabel={pesertaCount > 0 ? `${pesertaCount} peserta terdaftar` : 'Belum ada peserta'}
          href={`/classes/${id}/registrations`}
        />
        <DetailRow
          icon={<CheckSquare className="w-4 h-4" />}
          label="Absensi Hari Ini"
          sublabel={
            todaySession
              ? todayHadir > 0
                ? `${todayHadir} hadir`
                : 'Belum ada absensi'
              : 'Tidak ada sesi hari ini'
          }
          href={todaySession ? `/classes/${id}/attendance?date=${today}` : undefined}
          disabled={!todaySession}
        />
      </SectionList>

      {/* Section: Jadwal */}
      <SectionList label="Jadwal">
        <DetailRow
          icon={<CalendarDays className="w-4 h-4" />}
          label="Kelola Jadwal"
          sublabel={upcomingCount > 0 ? `${upcomingCount} sesi mendatang` : 'Tidak ada sesi mendatang'}
          href={`/classes/${id}/schedule`}
        />
      </SectionList>

      {/* Section: Statistik */}
      <SectionList label="Statistik">
        <DetailRow
          icon={<BarChart2 className="w-4 h-4" />}
          label="Riwayat Kehadiran"
          sublabel={monthlyHadir > 0 ? `${monthlyHadir} hadir bulan ini` : 'Belum ada kehadiran bulan ini'}
          href={`/classes/${id}/attendance`}
        />
      </SectionList>

      {/* Section: Pengaturan */}
      <SectionList label="Pengaturan">
        <DetailRow
          icon={<Settings className="w-4 h-4" />}
          label="Pengaturan Kelas"
          sublabel="Harga, kapasitas, grup WA, dan lainnya"
          href={`/classes/${id}/settings`}
        />
      </SectionList>
    </div>
  )
}
