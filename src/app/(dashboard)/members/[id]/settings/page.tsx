import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { MemberEditForm } from '@/components/members/MemberEditForm'
import { MemberPhotoUpload } from '@/components/members/MemberPhotoUpload'
import { DeleteButton } from '@/components/ui/DeleteButton'

export default async function MemberSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: member } = await (supabase.from('members') as any)
    .select('id, name, phone, notes, photo_url')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!member) notFound()

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref={`/members/${id}`}
        title="Pengaturan Member"
        subtitle={member.name}
      />

      {/* Foto */}
      <SectionList label="Foto" footer="Foto tampil di daftar member.">
        <div className="px-4 py-5 flex justify-center">
          <MemberPhotoUpload
            memberId={member.id}
            currentPhotoUrl={member.photo_url}
            size="lg"
          />
        </div>
      </SectionList>

      {/* Form edit */}
      <SectionList label="Informasi Member">
        <div className="px-4 py-4">
          <MemberEditForm member={member} />
        </div>
      </SectionList>

      {/* Zona berbahaya */}
      <SectionList label="Zona Berbahaya">
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 mb-3">
            Menghapus member akan menghapus semua data kehadiran secara permanen.
          </p>
          <DeleteButton
            table="members"
            id={member.id}
            redirectTo="/members"
            confirmText={`Hapus member "${member.name}"? Data kehadiran akan terhapus permanen.`}
          />
        </div>
      </SectionList>
    </div>
  )
}
