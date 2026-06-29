import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { ClassTypeWaGroupForm } from '@/components/community/ClassTypeWaGroupForm'
import { CLASS_TYPES } from '@/lib/constants'

export default async function CommunitySetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [classesRes, benefitsRes] = await Promise.all([
    supabase.from('classes').select('type').eq('user_id', user!.id),
    supabase.from('class_type_benefits')
      .select('type, wa_invite_link, wa_group_id')
      .eq('user_id', user!.id),
  ])

  const usedTypes    = Array.from(new Set((classesRes.data ?? []).map((c: any) => c.type)))
  const availTypes   = CLASS_TYPES.filter(t => usedTypes.includes(t.value))
  const typeLabel    = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  const inviteLinkMap = Object.fromEntries(
    ((benefitsRes.data ?? []) as any[]).map(b => [b.type, b.wa_invite_link ?? ''])
  )
  const groupIdMap = Object.fromEntries(
    ((benefitsRes.data ?? []) as any[]).map(b => [b.type, b.wa_group_id ?? ''])
  )

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader
        backHref="/community"
        title="Pengaturan Komunitas"
        subtitle="Konfigurasi grup WhatsApp per jenis kelas"
      />

      <SectionList
        label="Grup WA Komunitas"
        footer="Anggota yang chat di grup ini akan otomatis masuk database komunitas. Link invite ditampilkan di landing page instruktur."
      >
        <div className="px-4 py-4 space-y-4">
          {availTypes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Tambah kelas terlebih dahulu untuk mengatur grup WA komunitas.
            </p>
          ) : (
            availTypes.map(t => (
              <ClassTypeWaGroupForm
                key={t.value}
                userId={user!.id}
                type={t.value}
                label={typeLabel[t.value] ?? t.value}
                initialLink={inviteLinkMap[t.value] ?? ''}
                initialGroupId={groupIdMap[t.value] ?? ''}
              />
            ))
          )}
        </div>
      </SectionList>
    </div>
  )
}
