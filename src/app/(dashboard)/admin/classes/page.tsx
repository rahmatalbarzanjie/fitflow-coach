import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { InstructorFilter } from '@/components/admin/InstructorFilter'
import { getDayName, formatTime, formatRupiah } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ instructor?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound()

  const { instructor = '' } = await searchParams
  const supa = createServiceClient()

  const [profilesRes, classesRes] = await Promise.all([
    supa.from('profiles').select('id, name, business_name').order('name'),
    instructor
      ? supa
          .from('classes')
          .select('id, name, type, day_of_week, start_time, end_time, class_price, revenue_share_pct, is_active, user_id')
          .eq('user_id', instructor)
          .order('day_of_week').order('start_time')
      : supa
          .from('classes')
          .select('id, name, type, day_of_week, start_time, end_time, class_price, revenue_share_pct, is_active, user_id')
          .eq('is_active', true)
          .order('day_of_week').order('start_time')
          .limit(200),
  ])

  const profiles = (profilesRes.data ?? []) as { id: string; name: string; business_name: string | null }[]
  const classes  = (classesRes.data ?? []) as any[]
  const profileMap   = Object.fromEntries(profiles.map(p => [p.id, p.business_name ?? p.name]))
  const typeLabel    = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Semua Kelas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{classes.length} kelas{!instructor ? ' aktif (max 200)' : ''}</p>
        </div>
      </div>

      <div className="mb-4">
        <InstructorFilter profiles={profiles} selected={instructor} />
      </div>

      {!classes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Belum ada kelas{instructor ? ' untuk instruktur ini' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kelas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Jadwal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Harga</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Instruktur</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(cls => (
                <tr key={cls.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{cls.name}</p>
                    <p className="text-xs text-gray-400">{typeLabel[cls.type] ?? cls.type}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                    {getDayName(cls.day_of_week)}, {formatTime(cls.start_time)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                    {cls.class_price ? `${formatRupiah(cls.class_price)} · ${cls.revenue_share_pct ?? 50}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Link href={`/admin/${cls.user_id}`} className="text-gray-500 hover:text-violet-600 transition-colors">
                      {profileMap[cls.user_id] ?? '—'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
