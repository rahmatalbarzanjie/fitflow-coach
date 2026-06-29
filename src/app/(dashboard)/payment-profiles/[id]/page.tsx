import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { PaymentProfileForm } from '@/components/paymentProfiles/PaymentProfileForm'
import { PaymentMethodList } from '@/components/paymentProfiles/PaymentMethodList'
import { getPaymentProfileUsage } from '@/lib/paymentProfiles'

export default async function PaymentProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, methodsRes, usage] = await Promise.all([
    supabase.from('payment_profiles').select('id, name, is_active').eq('id', id).eq('user_id', user!.id).single(),
    supabase
      .from('payment_methods')
      .select('id, method_type, bank_name, account_number, account_name, qris_image_url, sort_order')
      .eq('payment_profile_id', id)
      .order('sort_order'),
    getPaymentProfileUsage(supabase, id),
  ])

  const profile = profileRes.data
  if (!profile) notFound()

  const hasUsage = usage.classes.length > 0 || usage.events.length > 0 || usage.packages.length > 0
  // Severity (dipakai PaymentMethodList & PaymentProfileForm untuk
  // escalate pesan) cuma dari classes/events - package belum punya jalur
  // pembelian publik, jadi belum risiko nyata ke peserta.
  const classCount = usage.classes.length
  const eventCount = usage.events.length

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref="/payment-profiles" title={profile.name} />

      <SectionList label="Nama & Status">
        <div className="px-4 py-4">
          <PaymentProfileForm profile={profile} classCount={classCount} eventCount={eventCount} />
        </div>
      </SectionList>

      {hasUsage && (
        <SectionList label="Digunakan Oleh">
          <div className="px-4 py-4 space-y-3">
            {usage.classes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Kelas</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {usage.classes.map(c => <li key={c.id}>• {c.name}</li>)}
                </ul>
              </div>
            )}
            {usage.events.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Event</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {usage.events.map(e => <li key={e.id}>• {e.title}</li>)}
                </ul>
              </div>
            )}
            {usage.packages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Membership Package</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {usage.packages.map(pk => <li key={pk.id}>• {pk.name}</li>)}
                </ul>
              </div>
            )}
          </div>
        </SectionList>
      )}

      <SectionList
        label="Metode Pembayaran"
        footer="Peserta akan melihat semua metode di bawah ini saat membayar kelas/event yang memakai profile ini."
      >
        <div className="px-4 py-4">
          <PaymentMethodList
            profileId={profile.id}
            userId={user!.id}
            initialMethods={(methodsRes.data as any[]) ?? []}
            classCount={classCount}
            eventCount={eventCount}
          />
        </div>
      </SectionList>
    </div>
  )
}
