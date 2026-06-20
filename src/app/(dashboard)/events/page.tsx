import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { EventsList } from '@/components/events/EventsList'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [eventsRes, profileRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, event_date, start_time, location, status, registrations(id, payment_status)')
      .eq('user_id', user!.id)
      .order('event_date', { ascending: false }),
    supabase.from('profiles').select('slug').eq('id', user!.id).single(),
  ])

  const events = (eventsRes.data ?? []) as any[]
  const slug   = profileRes.data?.slug

  const rawUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const appUrl    = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl
  const publicBase = slug && appUrl ? `${appUrl}/${slug}` : null

  const pendingTotal = events.reduce((sum, ev) => {
    const regs = Array.isArray(ev.registrations) ? ev.registrations : []
    return sum + regs.filter((r: any) => r.payment_status === 'pending').length
  }, 0)

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {events.length} event
            {pendingTotal > 0 && (
              <span className="ml-2 text-orange-500 font-semibold">
                · {pendingTotal} menunggu konfirmasi
              </span>
            )}
          </p>
        </div>
        <Link
          href="/events/new"
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Buat Event
        </Link>
      </div>

      <EventsList events={events} publicBase={publicBase} />
    </div>
  )
}
