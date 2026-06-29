import { PageHeader } from '@/components/ui/PageHeader'
import { WhatsAppConnectFlow } from '@/components/settings/WhatsAppConnectFlow'

export default function WhatsAppConnectPage() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref="/settings/whatsapp" title="Hubungkan WhatsApp" />
      <WhatsAppConnectFlow />
    </div>
  )
}
