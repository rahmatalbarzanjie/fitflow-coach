import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { AdminInstructorsList } from '@/components/admin/AdminInstructorsList'

export default async function AdminInstructorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user?.email !== adminEmail) notFound()

  const serviceSupabase = createServiceClient()
  const { data: profilesRaw } = await serviceSupabase
    .from('profiles')
    .select('*')
    .neq('id', user!.id)
    .order('created_at', { ascending: false })

  const profiles = (profilesRaw ?? []) as any[]

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-gray-700" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Instruktur</h1>
          <p className="text-sm text-gray-400">{profiles.length} instruktur terdaftar</p>
        </div>
      </div>

      <Card>
        <AdminInstructorsList profiles={profiles} />
      </Card>
    </div>
  )
}
