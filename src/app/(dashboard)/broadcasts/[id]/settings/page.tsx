import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { BroadcastSettingsForm } from '@/components/broadcasts/BroadcastSettingsForm'

export default async function BroadcastSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [bcRes, classesRes, recipientsRes] = await Promise.all([
    supabase.from('broadcasts').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('classes').select('id, name, wa_group_id, wa_group_name').eq('user_id', user!.id).not('wa_group_id', 'is', null),
    supabase.from('broadcast_recipients').select('status').eq('broadcast_id', id),
  ])

  if (!bcRes.data) notFound()

  const sentCount = ((recipientsRes.data ?? []) as { status: string }[]).filter(r => r.status === 'sent').length

  return (
    <div className="w-full max-w-lg mx-auto pb-10">
      <PageHeader
        backHref={`/broadcasts/${id}`}
        title="Pengaturan Broadcast"
        subtitle={bcRes.data.title}
      />
      <BroadcastSettingsForm
        broadcast={bcRes.data}
        groupClasses={(classesRes.data ?? []) as any[]}
        locked={sentCount > 0}
      />
    </div>
  )
}
