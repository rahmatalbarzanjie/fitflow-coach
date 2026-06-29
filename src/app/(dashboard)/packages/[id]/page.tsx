import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { PackageForm } from '@/components/packages/PackageForm'
import { getEligiblePaymentProfiles } from '@/lib/paymentProfiles'

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: pkg }, paymentProfiles] = await Promise.all([
    supabase
      .from('membership_packages')
      .select('id, name, package_type, class_type, total_sessions, duration_days, price, is_active, payment_profile_id')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single(),
    getEligiblePaymentProfiles(supabase, user!.id),
  ])

  if (!pkg) notFound()

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref="/packages" title="Edit Paket" subtitle={pkg.name} />
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <PackageForm pkg={pkg as any} paymentProfiles={paymentProfiles} />
      </div>
    </div>
  )
}
