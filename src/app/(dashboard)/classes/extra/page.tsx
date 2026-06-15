import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { ExtraClassForm } from './ExtraClassForm'

export const metadata = { title: 'Kelas Ekstra — FitFlow Coach' }

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
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/classes" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tambah Kelas Ekstra</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sesi tambahan di luar jadwal rutin</p>
        </div>
      </div>

      <Card>
        <ExtraClassForm classes={classes ?? []} />
      </Card>
    </div>
  )
}
