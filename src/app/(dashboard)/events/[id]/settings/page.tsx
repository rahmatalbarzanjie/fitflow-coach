import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { EventSettingsForm } from '@/components/events/EventSettingsForm'

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [evRes, regCountRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', id),
  ])

  if (!evRes.data) notFound()

  const hasRegistrations = (regCountRes.count ?? 0) > 0

  return (
    <div className="w-full max-w-lg mx-auto pb-10">
      <PageHeader
        backHref={`/events/${id}`}
        title="Pengaturan Event"
        subtitle={evRes.data.title}
      />
      <EventSettingsForm ev={evRes.data} hasRegistrations={hasRegistrations} />
    </div>
  )
}
