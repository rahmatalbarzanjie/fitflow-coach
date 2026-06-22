import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ClassSettingsForm } from '@/components/classes/ClassSettingsForm'
import { ClassGalleryUpload } from '@/components/classes/ClassGalleryUpload'
import { WaGroupPicker } from '@/components/classes/WaGroupPicker'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { SectionList } from '@/components/ui/SectionList'
import { getEligiblePaymentProfiles } from '@/lib/paymentProfiles'

export default async function ClassSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: cls }, { data: galleryPhotos }, paymentProfiles] = await Promise.all([
    supabase.from('classes').select('*').eq('id', id).eq('user_id', user!.id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('class_gallery') as any)
      .select('id, image_url, sort_order')
      .eq('class_id', id)
      .order('sort_order'),
    getEligiblePaymentProfiles(supabase, user!.id),
  ])

  if (!cls) notFound()

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref={`/classes/${id}`}
        title="Pengaturan Kelas"
        subtitle={cls.name}
      />

      {/* Form edit — foto sudah termasuk di dalam ClassSettingsForm */}
      <SectionList label="Informasi Kelas">
        <div className="px-4 py-4">
          <ClassSettingsForm cls={cls} classId={id} paymentProfiles={paymentProfiles} />
        </div>
      </SectionList>

      {/* Dokumentasi Kelas */}
      <SectionList
        label="Dokumentasi kelas & suasana latihan"
        footer="Tampilkan suasana studio, fasilitas, aktivitas peserta, atau momen kelas untuk membangun kepercayaan calon peserta."
      >
        <div className="px-4 py-4">
          <ClassGalleryUpload
            classId={cls.id}
            userId={user!.id}
            initialPhotos={(galleryPhotos as any[]) ?? []}
          />
        </div>
      </SectionList>

      {/* Grup WA */}
      <SectionList
        label="Grup WhatsApp"
        footer="Grup WA Level 2 khusus peserta kelas ini (bukan komunitas umum)."
      >
        <div className="px-4 py-4">
          <WaGroupPicker
            classId={cls.id}
            currentGroupId={(cls as any).wa_group_id ?? null}
            currentGroupName={(cls as any).wa_group_name ?? null}
          />
        </div>
      </SectionList>

      {/* Hapus kelas */}
      <SectionList label="Zona Berbahaya">
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 mb-3">
            Menghapus kelas akan menghapus semua sesi dan riwayat absensi secara permanen.
          </p>
          <DeleteButton
            table="classes"
            id={cls.id}
            redirectTo="/classes"
            confirmText={`Hapus kelas "${cls.name}"? Semua sesi dan absensi akan terhapus.`}
          />
        </div>
      </SectionList>
    </div>
  )
}
