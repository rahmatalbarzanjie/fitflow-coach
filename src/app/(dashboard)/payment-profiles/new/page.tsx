import { PageHeader } from '@/components/ui/PageHeader'
import { PaymentProfileForm } from '@/components/paymentProfiles/PaymentProfileForm'

export default function NewPaymentProfilePage() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref="/payment-profiles" title="Tambah Payment Profile" />
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <PaymentProfileForm />
      </div>
    </div>
  )
}
