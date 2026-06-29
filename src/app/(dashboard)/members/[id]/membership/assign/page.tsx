import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { AssignPackageForm } from '@/components/members/AssignPackageForm'

export default async function AssignPackagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [memberRes, packagesRes, activeRes] = await Promise.all([
    supabase.from('members').select('id, name').eq('id', id).eq('user_id', user!.id).single(),
    supabase
      .from('membership_packages')
      .select('id, name, package_type, total_sessions, duration_days, price')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('member_memberships')
      .select('id, end_date, package_name')
      .eq('member_id', id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const member = memberRes.data
  if (!member) notFound()

  const packages = (packagesRes.data ?? []) as any[]

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref={`/members/${id}/membership`} title="Assign Paket" subtitle={member.name} />

      {packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400">
            Belum ada paket di katalog. Buat paket dulu di menu{' '}
            <span className="font-semibold text-gray-600">Packages</span>.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <AssignPackageForm
            memberId={member.id}
            userId={user!.id}
            packages={packages}
            activeMembership={activeRes.data as any}
          />
        </div>
      )}
    </div>
  )
}
