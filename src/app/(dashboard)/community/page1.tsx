import { createClient } from '@/lib/supabase/server'
import { Users2 } from 'lucide-react'
import { AddContactForm } from '@/components/community/AddContactForm'
import { ConvertToMemberButton } from '@/components/community/ConvertToMemberButton'
import { ClassTypeWaGroupForm } from '@/components/community/ClassTypeWaGroupForm'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Card } from '@/components/ui/card'
import { formatDateShort } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  poundfit: { label: 'Poundfit', color: 'bg-red-100 text-red-600' },
  barre:    { label: 'Barre',    color: 'bg-pink-100 text-pink-600' },
  zumba:    { label: 'Zumba',    color: 'bg-yellow-100 text-yellow-700' },
  yoga:     { label: 'Yoga',     color: 'bg-green-100 text-green-700' },
  pilates:  { label: 'Pilates',  color: 'bg-blue-100 text-blue-600' },
  aerobic:  { label: 'Aerobic',  color: 'bg-orange-100 text-orange-600' },
  other:    { label: 'Lainnya',  color: 'bg-gray-100 text-gray-600' },
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type: typeFilter = '' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [classesRes, contactsRes, typeBenefitsRes] = await Promise.all([
    // Ambil jenis kelas unik yang dimiliki instruktur
    supabase.from('classes').select('id, name, type').eq('user_id', user!.id).order('name'),

    // Komunitas: filter by class_type kalau ada filter
    (() => {
      let q = supabase
        .from('community_contacts')
        .select('id, name, phone, notes, created_at, class_type, converted_member_id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (typeFilter) q = (q as any).eq('class_type', typeFilter)
      return q
    })(),

    supabase.from('class_type_benefits').select('type, wa_invite_link').eq('user_id', user!.id),
  ])

  const classes  = (classesRes.data ?? []) as { id: string; name: string; type: string }[]
  const contacts = (contactsRes.data ?? []) as any[]

  // Jenis kelas unik yang instruktur ini punya
  const usedTypes = Array.from(new Set(classes.map(c => c.type)))
  const availableTypes = CLASS_TYPES.filter(t => usedTypes.includes(t.value))

  const inviteLinkMap = Object.fromEntries(
    ((typeBenefitsRes.data ?? []) as any[]).map(b => [b.type, b.wa_invite_link ?? ''])
  )
  const groupIdMap = Object.fromEntries(
    ((typeBenefitsRes.data ?? []) as any[]).map(b => [b.type, b.wa_group_id ?? ''])
  )
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Komunitas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {contacts.length} kontak — peserta aktif yang belum tentu Member berbayar
          </p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-4">
        <p className="text-xs text-blue-700">
          Kontak komunitas otomatis muncul di absensi sesuai jenis kelasnya.
          Walk-in saat absensi juga tersimpan di sini.
        </p>
      </div>

      {/* Grup WA per jenis kelas */}
      {usedTypes.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Grup WA Komunitas</h2>
          <p className="text-xs text-gray-400 mb-4">
            Link invite grup WA per jenis kelas. Ditampilkan di landing page instruktur.
          </p>
          <div className="space-y-2">
            {usedTypes.map(type => (
              <ClassTypeWaGroupForm
                key={type}
                userId={user!.id}
                type={type}
                label={typeLabel[type] ?? type}
                initialLink={inviteLinkMap[type] ?? ''}
                initialGroupId={groupIdMap[type] ?? ''}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Toolbar: tambah + filter */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <AddContactForm availableTypes={availableTypes} />

        {/* Filter by class type */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/community"
            className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
              !typeFilter
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semua
          </a>
          {availableTypes.map(t => (
            <a
              key={t.value}
              href={`/community?type=${t.value}`}
              className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                typeFilter === t.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      {/* List kontak */}
      {!contacts.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Users2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {typeFilter ? `Belum ada kontak komunitas ${typeLabel[typeFilter] ?? typeFilter}` : 'Belum ada kontak komunitas'}
          </p>
          <p className="text-xs text-gray-300 mt-1">
            Tambah manual atau akan otomatis terisi dari walk-in absensi
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => {
            const badge = c.class_type ? TYPE_BADGE[c.class_type] : null
            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{c.name ?? '(tanpa nama)'}</p>
                    {badge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{c.phone ?? 'No. HP tidak ada'}</p>
                  <p className="text-xs text-gray-300 mt-0.5">{formatDateShort(c.created_at)}</p>
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
                  <DeleteButton
                    table="community_contacts"
                    id={c.id}
                    redirectTo="/community"
                    confirmText="Hapus kontak ini?"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
