import { createClient } from '@/lib/supabase/server'
import { Users2 } from 'lucide-react'
import { AddContactForm } from '@/components/community/AddContactForm'
import { ConvertToMemberButton } from '@/components/community/ConvertToMemberButton'
import { ClassTypeWaGroupForm } from '@/components/community/ClassTypeWaGroupForm'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Card } from '@/components/ui/card'
import { formatDateShort } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>
}) {
  const { class: classFilter = '' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [classesRes, contactsRes, typeBenefitsRes] = await Promise.all([
    supabase.from('classes').select('id, name, type').eq('user_id', user!.id).order('name'),
    (() => {
      let q = supabase
        .from('community_contacts')
        .select('id, name, phone, notes, created_at, class_id, converted_member_id, classes(name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (classFilter) q = q.eq('class_id', classFilter)
      return q
    })(),
    supabase.from('class_type_benefits').select('type, wa_invite_link').eq('user_id', user!.id),
  ])

  const classes  = (classesRes.data ?? []) as { id: string; name: string; type: string }[]
  const contacts = (contactsRes.data ?? []) as any[]
  const usedTypes = Array.from(new Set(classes.map(c => c.type)))
  const inviteLinkMap = Object.fromEntries(
    ((typeBenefitsRes.data ?? []) as any[]).map(b => [b.type, b.wa_invite_link ?? ''])
  )
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Komunitas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contacts.length} kontak - orang di grup WA, belum tentu Member</p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-4">
        <p className="text-xs text-blue-700">
          Ini bukan daftar Member berbayar. Konversi ke Member kalau orang ini sudah mendaftar & bayar resmi.
        </p>
      </div>

      {usedTypes.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Grup WA Komunitas</h2>
          <p className="text-xs text-gray-400 mb-4">
            Tempel link invite grup WA per olahraga di sini (Info Grup → Undang via Tautan → Salin Link di WhatsApp).
            Link ini yang ditampilkan di landing page untuk orang yang mau join komunitas - kalau belum diisi,
            landing page tetap pakai tombol chat WA seperti biasa.
          </p>
          <div className="space-y-2">
            {usedTypes.map(type => (
              <ClassTypeWaGroupForm
                key={type}
                userId={user!.id}
                type={type}
                label={typeLabel[type] ?? type}
                initialLink={inviteLinkMap[type] ?? ''}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <AddContactForm classes={classes} />
        {classes.length > 0 && (
          <form>
            <select
              name="class"
              defaultValue={classFilter}
              className="h-9 px-3 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white"
            >
              <option value="">Semua Kelas</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </form>
        )}
      </div>

      {!contacts.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Users2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Belum ada kontak komunitas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{c.name ?? '(tanpa nama)'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.phone ?? 'No. HP tidak ada'}</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {(c.classes as any)?.name ? `${(c.classes as any).name} · ` : ''}
                  {formatDateShort(c.created_at)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {c.converted_member_id ? (
                  <span className="text-xs text-green-600 font-medium">✓ Sudah jadi Member</span>
                ) : (
                  <ConvertToMemberButton
                    contactId={c.id}
                    initialName={c.name ?? ''}
                    initialPhone={c.phone ?? ''}
                  />
                )}
                <DeleteButton table="community_contacts" id={c.id} redirectTo="/community" confirmText="Hapus kontak ini?" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
