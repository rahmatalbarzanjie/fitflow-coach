import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { PackageForm } from '@/components/packages/PackageForm'
import { getEligiblePaymentProfiles } from '@/lib/paymentProfiles'

export default async function NewPackagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const paymentProfiles = await getEligiblePaymentProfiles(supabase, user!.id)

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/packages" title="Tambah Paket" />
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <PackageForm paymentProfiles={paymentProfiles} />
      </div>
    </div>
  )
}
