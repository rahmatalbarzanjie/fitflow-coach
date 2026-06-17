import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { Activity, Heart } from 'lucide-react'
import { TestimonialSubmitForm } from '@/components/public/TestimonialSubmitForm'

export default async function TestimonialFormPage({
  params,
}: {
  params: Promise<{ slug: string; memberId: string }>
}) {
  const { slug, memberId } = await params
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, business_name')
    .eq('slug', slug)
    .single()

  if (!profile) notFound()

  const { data: member } = await supabase
    .from('members')
    .select('id, name')
    .eq('id', memberId)
    .eq('user_id', profile.id)
    .single()

  if (!member) notFound()

  const { data: existing } = await supabase
    .from('testimonials')
    .select('id')
    .eq('member_id', memberId)
    .maybeSingle()

  const studio = (profile as any).business_name ?? profile.name

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-pink-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600 rounded-2xl mb-3">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Testimoni untuk {studio}</h1>
          <p className="text-sm text-gray-400 mt-1">Bagikan pengalamanmu ikut kelas di sini</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {existing ? (
            <div className="text-center py-8">
              <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-900 mb-1">Terima kasih, {member.name}! 🙏</p>
              <p className="text-sm text-gray-500">Kamu sudah pernah memberi testimoni sebelumnya.</p>
            </div>
          ) : (
            <TestimonialSubmitForm memberId={member.id} memberName={member.name} />
          )}
        </div>
      </div>
    </div>
  )
}
