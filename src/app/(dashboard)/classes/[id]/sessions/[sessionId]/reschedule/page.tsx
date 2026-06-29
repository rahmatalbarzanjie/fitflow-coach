import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { RescheduleForm } from '@/components/classes/RescheduleForm'
import { formatDateShort } from '@/lib/utils'

export default async function RescheduleSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: session }, { data: cls }] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', sessionId).eq('user_id', user!.id).single(),
    supabase.from('classes').select('id, name, location, day_of_week').eq('id', id).eq('user_id', user!.id).single(),
  ])

  if (!session || !cls) notFound()

  const backHref = `/classes/${id}/sessions/${sessionId}`

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader
        backHref={backHref}
        title="Reschedule Sesi"
        subtitle={`${cls.name} · ${formatDateShort(session.session_date)}`}
      />
      <RescheduleForm
        sessionId={sessionId}
        className={cls.name}
        location={cls.location ?? ''}
        dayOfWeek={cls.day_of_week}
        sessionDate={session.session_date}
        startTime={session.start_time}
        endTime={session.end_time}
        backHref={backHref}
      />
    </div>
  )
}
