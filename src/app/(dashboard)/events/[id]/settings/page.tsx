import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { EventSettingsForm } from '@/components/events/EventSettingsForm'
import { EventGalleryUpload } from '@/components/events/EventGalleryUpload'
import { getEligiblePaymentProfiles } from '@/lib/paymentProfiles'

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [evRes, regCountRes, galleryRes, paymentProfiles] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('event_gallery') as any)
      .select('id, image_url, sort_order')
      .eq('event_id', id)
      .order('sort_order'),
    getEligiblePaymentProfiles(supabase, user!.id),
  ])

  if (!evRes.data) notFound()

  const hasRegistrations = (regCountRes.count ?? 0) > 0

  return (
    <div className="w-full max-w-2xl mx-auto pb-10">
      <PageHeader
        backHref={`/events/${id}`}
        title="Pengaturan Event"
        subtitle={evRes.data.title}
      />
      <EventSettingsForm ev={evRes.data} hasRegistrations={hasRegistrations} paymentProfiles={paymentProfiles} />

      <SectionList
        label="Dokumentasi event & suasana kegiatan"
        className="mt-4"
        footer="Tampilkan venue, peserta, aktivitas, dan momen event untuk membangun kepercayaan calon peserta."
      >
        <div className="px-4 py-4">
          <EventGalleryUpload
            eventId={evRes.data.id}
            userId={user!.id}
            initialPhotos={(galleryRes.data as any[]) ?? []}
          />
        </div>
      </SectionList>
    </div>
  )
}
