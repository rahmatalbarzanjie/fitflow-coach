import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ExtraClassForm } from './ExtraClassForm'

export const metadata = { title: 'Kelas Ekstra - FitFlow Coach' }

export default async function ExtraClassPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, type, start_time, end_time, location')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref="/classes"
        title="Tambah Kelas Ekstra"
        subtitle="Sesi tambahan di luar jadwal rutin"
      />

      <Card>
        <ExtraClassForm classes={classes ?? []} />
      </Card>
    </div>
  )
}
