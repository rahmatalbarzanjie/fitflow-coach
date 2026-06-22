import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { PaymentProfileForm } from '@/components/paymentProfiles/PaymentProfileForm'
import { PaymentMethodList } from '@/components/paymentProfiles/PaymentMethodList'

export default async function PaymentProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, methodsRes] = await Promise.all([
    supabase.from('payment_profiles').select('id, name, is_active').eq('id', id).eq('user_id', user!.id).single(),
    supabase
      .from('payment_methods')
      .select('id, method_type, bank_name, account_number, account_name, qris_image_url, sort_order')
      .eq('payment_profile_id', id)
      .order('sort_order'),
  ])

  const profile = profileRes.data
  if (!profile) notFound()

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/payment-profiles" title={profile.name} />

      <SectionList label="Nama & Status">
        <div className="px-4 py-4">
          <PaymentProfileForm profile={profile} />
        </div>
      </SectionList>

      <SectionList
        label="Metode Pembayaran"
        footer="Peserta akan melihat semua metode di bawah ini saat membayar kelas/event yang memakai profile ini."
      >
        <div className="px-4 py-4">
          <PaymentMethodList
            profileId={profile.id}
            userId={user!.id}
            initialMethods={(methodsRes.data as any[]) ?? []}
          />
        </div>
      </SectionList>
    </div>
  )
}
