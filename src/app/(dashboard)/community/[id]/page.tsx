import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import {
  Phone, Tag, Calendar, Radio,
  UserPlus, MessageSquare, Settings,
  MessageCircle, Clock,
} from 'lucide-react'
import { CLASS_TYPES } from '@/lib/constants'
import { formatDateShort } from '@/lib/utils'

const SOURCE_LABEL: Record<string, string> = {
  manual:   'Input manual',
  wa_group: 'Grup WhatsApp',
  walkin:   'Walk-in kelas',
  booking:  'Booking kelas',
}

const TYPE_LABEL = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

export default async function CommunityHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: contact } = await supabase
    .from('community_contacts')
    .select('id, name, phone, class_type, source, created_at, converted_member_id, notes')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!contact) notFound()

  const isMember = !!contact.converted_member_id
  const memberWa = contact.phone?.replace(/\D/g, '').replace(/^0/, '62')
  const waLink   = memberWa
    ? `https://wa.me/${memberWa}`
    : null

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref="/community" title={contact.name ?? '(tanpa nama)'} />

      {/* Profil singkat */}
      <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-violet-600 font-bold text-xl">
            {(contact.name ?? '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-gray-900">
              {contact.name ?? '(tanpa nama)'}
            </p>
            {isMember && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                Member
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {contact.phone ?? 'No. HP tidak ada'}
          </p>
        </div>
      </div>

      {/* Section: Info */}
      <SectionList label="Info">
        <DetailRow
          icon={<Phone className="w-4 h-4" />}
          label="Nomor HP"
          value={contact.phone ?? '—'}
          chevron={false}
        />
        <DetailRow
          icon={<Tag className="w-4 h-4" />}
          label="Jenis Kelas"
          value={contact.class_type ? (TYPE_LABEL[contact.class_type] ?? contact.class_type) : 'Komunitas Umum'}
          chevron={false}
        />
        <DetailRow
          icon={<Calendar className="w-4 h-4" />}
          label="Bergabung"
          value={formatDateShort(contact.created_at)}
          chevron={false}
        />
        <DetailRow
          icon={<Radio className="w-4 h-4" />}
          label="Sumber"
          value={SOURCE_LABEL[contact.source] ?? contact.source}
          chevron={false}
        />
      </SectionList>

      {/* Section: Aktivitas — fondasi AI/WA di masa depan */}
      <SectionList
        label="Aktivitas"
        footer="Data interaksi akan tersedia setelah integrasi WhatsApp AI aktif."
      >
        <DetailRow
          icon={<MessageCircle className="w-4 h-4" />}
          label="Jumlah Interaksi"
          value="Belum tersedia"
          chevron={false}
        />
        <DetailRow
          icon={<Clock className="w-4 h-4" />}
          label="Terakhir Aktif"
          value="Belum tersedia"
          chevron={false}
        />
      </SectionList>

      {/* Section: Operasional */}
      <SectionList label="Operasional">
        {!isMember ? (
          <DetailRow
            icon={<UserPlus className="w-4 h-4" />}
            label="Jadikan Member"
            sublabel="Daftarkan sebagai member berbayar"
            href={`/community/${id}/convert`}
          />
        ) : (
          <DetailRow
            icon={<UserPlus className="w-4 h-4" />}
            label="Sudah Menjadi Member"
            sublabel="Kontak ini sudah terdaftar sebagai member"
            chevron={false}
            disabled
          />
        )}
        <DetailRow
          icon={<MessageSquare className="w-4 h-4" />}
          label="Kirim Pesan WhatsApp"
          sublabel={contact.phone ? 'Hubungi kontak langsung' : 'Nomor HP tidak tersedia'}
          href={waLink ?? undefined}
          disabled={!waLink}
        />
      </SectionList>

      {/* Section: Pengaturan */}
      <SectionList label="Pengaturan">
        <DetailRow
          icon={<Settings className="w-4 h-4" />}
          label="Pengaturan Kontak"
          sublabel="Edit nama, HP, dan jenis kelas"
          href={`/community/${id}/settings`}
        />
      </SectionList>
    </div>
  )
}
