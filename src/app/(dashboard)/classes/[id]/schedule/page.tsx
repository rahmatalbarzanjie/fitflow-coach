import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ClassScheduleManager } from '../ClassScheduleManager'

export default async function ClassSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: cls } = await supabase
    .from('classes')
    .select('id, name, type, day_of_week, start_time, end_time, location')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!cls) notFound()

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref={`/classes/${id}`}
        title="Kelola Jadwal"
        subtitle={cls.name}
      />

      <ClassScheduleManager
        classId={cls.id}
        className={cls.name}
        location={cls.location ?? null}
        dayOfWeek={cls.day_of_week}
        startTime={cls.start_time}
        endTime={cls.end_time}
      />
    </div>
  )
}
