import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { Activity, Heart } from 'lucide-react'
import { FeedbackSubmitForm } from '@/components/public/FeedbackSubmitForm'

export default async function FeedbackFormPage({
  params,
}: {
  params: Promise<{ slug: string; inviteId: string }>
}) {
  const { slug, inviteId } = await params
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, business_name')
    .eq('slug', slug)
    .single()

  if (!profile) notFound()

  const { data: invite } = await supabase
    .from('feedback_invites')
    .select('id, user_id, used')
    .eq('id', inviteId)
    .single()

  if (!invite || (invite as any).user_id !== profile.id) notFound()

  const studio = (profile as any).business_name ?? profile.name

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-pink-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600 rounded-2xl mb-3">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Kritik & Saran untuk {studio}</h1>
          <p className="text-sm text-gray-400 mt-1">Bantu kami jadi lebih baik lagi</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {(invite as any).used ? (
            <div className="text-center py-8">
              <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-900 mb-1">Terima kasih! 🙏</p>
              <p className="text-sm text-gray-500">Kamu sudah mengirim feedback untuk sesi ini sebelumnya.</p>
            </div>
          ) : (
            <FeedbackSubmitForm inviteId={(invite as any).id} />
          )}
        </div>
      </div>
    </div>
  )
}
