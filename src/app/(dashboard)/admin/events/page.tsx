import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { InstructorFilter } from '@/components/admin/InstructorFilter'
import { Badge } from '@/components/ui/badge'
import { formatDateShort, formatRupiah } from '@/lib/utils'
import { EVENT_STATUS } from '@/lib/constants'

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'blue' | 'red'> = {
  draft: 'gray', published: 'green', completed: 'blue', cancelled: 'red',
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ instructor?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound()

  const { instructor = '' } = await searchParams
  const supa = createServiceClient()

  const [profilesRes, eventsRes] = await Promise.all([
    supa.from('profiles').select('id, name, business_name').neq('id', user.id).order('name'),
    instructor
      ? supa
          .from('events')
          .select('id, title, event_date, status, ots_price, early_bird_price, user_id')
          .eq('user_id', instructor)
          .order('event_date', { ascending: false })
      : supa
          .from('events')
          .select('id, title, event_date, status, ots_price, early_bird_price, user_id')
          .neq('user_id', user.id)
          .order('event_date', { ascending: false })
          .limit(200),
  ])

  const profiles  = (profilesRes.data ?? []) as { id: string; name: string; business_name: string | null }[]
  const events    = (eventsRes.data ?? []) as any[]
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.business_name ?? p.name]))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Semua Event</h1>
          <p className="text-sm text-gray-400 mt-0.5">{events.length} event{!instructor ? ' (max 200)' : ''}</p>
        </div>
      </div>

      <div className="mb-4">
        <InstructorFilter profiles={profiles} selected={instructor} />
      </div>

      {!events.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Belum ada event{instructor ? ' untuk instruktur ini' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Tanggal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Harga</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Instruktur</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{ev.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{formatDateShort(ev.event_date)}</td>
                  <td className="px-4 py-3 text-xs">
                    <Badge color={STATUS_COLOR[ev.status] ?? 'gray'}>{EVENT_STATUS[ev.status as keyof typeof EVENT_STATUS]?.label ?? ev.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                    {ev.ots_price ? formatRupiah(ev.ots_price) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                    <Link href={`/admin/${ev.user_id}`} className="hover:text-violet-600 transition-colors">
                      {profileMap[ev.user_id] ?? '—'}
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
