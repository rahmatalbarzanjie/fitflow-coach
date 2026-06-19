import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ClassSettingsForm } from '@/components/classes/ClassSettingsForm'
import { WaGroupPicker } from '@/components/classes/WaGroupPicker'
import { ClassPhotoUpload } from '@/components/classes/ClassPhotoUpload'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { SectionList } from '@/components/ui/SectionList'

export default async function ClassSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: cls } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!cls) notFound()

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref={`/classes/${id}`}
        title="Pengaturan Kelas"
        subtitle={cls.name}
      />

      {/* Foto kelas */}
      <SectionList label="Foto Kelas" footer="Foto tampil di landing page publik kamu.">
        <div className="px-4 py-4">
          <ClassPhotoUpload
            classId={cls.id}
            currentUrl={(cls as any).cover_image_url ?? null}
          />
        </div>
      </SectionList>

      {/* Form edit — pakai client wrapper */}
      <SectionList label="Informasi Kelas">
        <div className="px-4 py-4">
          <ClassSettingsForm cls={cls} classId={id} />
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
