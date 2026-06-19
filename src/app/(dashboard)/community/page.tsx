import { createClient } from '@/lib/supabase/server'
import { Users2 } from 'lucide-react'
import { AddContactForm } from '@/components/community/AddContactForm'
import { ClassTypeWaGroupForm } from '@/components/community/ClassTypeWaGroupForm'
import { Card } from '@/components/ui/card'
import { CLASS_TYPES } from '@/lib/constants'
import { CommunityTable } from '@/components/community/CommunityTable'

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type: typeFilter = '' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [classesRes, contactsRes, typeBenefitsRes] = await Promise.all([
    supabase.from('classes').select('id, name, type').eq('user_id', user!.id).order('name'),

    (() => {
      let q = supabase
        .from('community_contacts')
        .select('id, name, phone, notes, created_at, class_type, converted_member_id, source')
        .eq('user_id', user!.id)
        .order('name', { ascending: true })
      if (typeFilter) q = (q as any).eq('class_type', typeFilter)
      return q
    })(),

    supabase.from('class_type_benefits')
      .select('type, wa_invite_link, wa_group_id')
      .eq('user_id', user!.id),
  ])

  const classes  = (classesRes.data ?? []) as { id: string; name: string; type: string }[]
  const contacts = (contactsRes.data ?? []) as any[]

  const usedTypes      = Array.from(new Set(classes.map(c => c.type)))
  const availableTypes = CLASS_TYPES.filter(t => usedTypes.includes(t.value))
  const typeLabel      = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  const inviteLinkMap = Object.fromEntries(
    ((typeBenefitsRes.data ?? []) as any[]).map(b => [b.type, b.wa_invite_link ?? ''])
  )
  const groupIdMap = Object.fromEntries(
    ((typeBenefitsRes.data ?? []) as any[]).map(b => [b.type, b.wa_group_id ?? ''])
  )

  // Hitung per jenis kelas untuk summary
  const countByType = contacts.reduce<Record<string, number>>((acc, c) => {
    const t = c.class_type ?? 'unknown'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Komunitas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Peserta aktif yang belum tentu Member berbayar
          </p>
        </div>
        <AddContactForm availableTypes={availableTypes} />
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{contacts.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Kontak</p>
        </div>
        {usedTypes.map(type => (
          <div key={type} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-2xl font-bold text-violet-600">{countByType[type] ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">{typeLabel[type] ?? type}</p>
          </div>
        ))}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-green-600">
            {contacts.filter(c => c.converted_member_id).length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Jadi Member</p>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-6">
        <p className="text-xs text-blue-700">
          Kontak komunitas otomatis muncul di absensi sesuai jenis kelasnya.
          Walk-in saat absensi & anggota yang chat di grup WA juga tersimpan di sini.
        </p>
      </div>

      {/* ── Grup WA Setup ── */}
      {usedTypes.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Grup WA Komunitas</h2>
          <p className="text-xs text-gray-400 mb-4">
            Hubungkan grup WA per jenis kelas. Anggota yang chat di grup otomatis masuk database komunitas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {/* ── Tabel Kontak ── */}
      <CommunityTable
        contacts={contacts}
        typeFilter={typeFilter}
        availableTypes={availableTypes}
        typeLabel={typeLabel}
        userId={user!.id}
      />
    </div>
  )
}
