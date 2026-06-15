import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, CalendarDays, MapPin, Users, ChevronRight, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EVENT_STATUS } from '@/lib/constants'

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'blue' | 'orange' | 'red'> = {
  draft:     'gray',
  published: 'green',
  completed: 'blue',
  cancelled: 'red',
}

const STATUS_TABS = [
  { key: '',          label: 'Semua'   },
  { key: 'published', label: 'Aktif'   },
  { key: 'draft',     label: 'Draft'   },
  { key: 'completed', label: 'Selesai' },
]

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const status = params.status ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch events and profile slug separately (avoid IIFE in Promise.all)
  let eventsQuery = supabase
    .from('events')
    .select('id, title, slug, event_date, start_time, location, status, ots_price, early_bird_price, registrations(id, payment_status)')
    .eq('user_id', user.id)
    .order('event_date', { ascending: false })

  if (status) {
    eventsQuery = eventsQuery.eq('status', status as any)
  }

  const [{ data: events }, { data: profile }] = await Promise.all([
    eventsQuery,
    supabase.from('profiles').select('slug').eq('id', user.id).single(),
  ])

  const profileSlug = profile?.slug ?? null
  const rawUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const appUrl      = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Events</h1>
          <p className="text-sm text-gray-400 mt-0.5">{events?.length ?? 0} event</p>
        </div>
        <Link
          href="/events/new"
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Buat Event
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(tab => (
          <Link
            key={tab.key}
            href={tab.key ? `/events?status=${tab.key}` : '/events'}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!events?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarDays className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Belum ada event</p>
          <p className="text-xs text-gray-400 mb-4">Buat workshop atau event khusus pertamamu</p>
          <Link href="/events/new" className="text-sm text-violet-600 font-medium hover:underline">
            + Buat event
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(events as any[]).map(ev => {
            const regs      = Array.isArray(ev.registrations) ? ev.registrations : []
            const total     = regs.length
            const pending   = regs.filter((r: any) => r.payment_status === 'pending').length
            const confirmed = regs.filter((r: any) => r.payment_status === 'confirmed').length
            const regLink   = profileSlug && appUrl ? `${appUrl}/${profileSlug}/daftar/${ev.slug}` : null

            return (
              <div key={ev.id} className="bg-white rounded-2xl border border-gray-100 hover:border-violet-200 transition-colors">
                <Link href={`/events/${ev.id}`} className="block">
                  <div className="p-4 flex items-center gap-4">
                    {/* Date box */}
                    <div className="w-12 h-12 rounded-xl bg-violet-50 flex flex-col items-center justify-center shrink-0 text-violet-700">
                      <span className="text-xs font-medium leading-none">
                        {new Date(ev.event_date + 'T00:00').toLocaleDateString('id', { month: 'short' }).toUpperCase()}
                      </span>
                      <span className="text-xl font-bold leading-tight">
                        {new Date(ev.event_date + 'T00:00').getDate()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">{ev.title}</span>
                        <Badge color={STATUS_COLOR[ev.status] ?? 'gray'}>
                          {EVENT_STATUS[ev.status as keyof typeof EVENT_STATUS]?.label ?? ev.status}
                        </Badge>
                        {pending > 0 && (
                          <Badge color="orange">{pending} menunggu</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <Users className="w-3 h-3" />
                        {total} daftar · {confirmed} konfirmasi
                        {ev.location && (
                          <>
                            <MapPin className="w-3 h-3 ml-1" />
                            {ev.location}
                          </>
                        )}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                </Link>

                {/* Inline public link for published events */}
                {ev.status === 'published' && regLink && (
                  <div className="px-4 pb-3 border-t border-gray-50 flex items-center gap-2 pt-2">
                    <p className="text-xs text-gray-400 font-mono flex-1 truncate">{regLink}</p>
                    <a
                      href={regLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-violet-600 hover:underline shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Buka
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
