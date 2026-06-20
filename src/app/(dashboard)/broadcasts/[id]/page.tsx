import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { BroadcastSendButton } from '@/components/broadcasts/BroadcastSendButton'
import { BroadcastGroupSendButton } from '@/components/broadcasts/BroadcastGroupSendButton'
import { MessageSquareText, Users, Settings } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'

const AUDIENCE_LABEL: Record<string, string> = {
  all:      'Semua Member',
  active:   'Member Aktif',
  at_risk:  'Perlu Follow Up',
  inactive: 'Tidak Aktif',
  new:      'Member Baru',
}

const STATUS_CONFIG: Record<string, { label: string; color: 'gray' | 'green' | 'blue' }> = {
  draft:     { label: 'Draft',     color: 'gray'  },
  sent:      { label: 'Terkirim',  color: 'green' },
  scheduled: { label: 'Terjadwal', color: 'blue'  },
}

export default async function BroadcastHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: bc } = await supabase
    .from('broadcasts')
    .select('*, classes(wa_group_name)')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!bc) notFound()

  const audience = (bc as any).target_audience as string

  const [recipientsRes, targetCountRes] = await Promise.all([
    supabase.from('broadcast_recipients').select('status').eq('broadcast_id', id),

    // Jumlah target saat ini (bisa berubah dari saat broadcast dibuat -
    // member baru bergabung/keluar dari segmen) - dipakai untuk INFO,
    // bukan untuk menentukan siapa yang akan dikirimi (itu logicnya di
    // /send, dihitung ulang setiap kali kirim).
    audience === 'all'
      ? supabase.from('members').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).not('phone', 'is', null)
      : supabase.from('member_summary').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', audience),
  ])

  const recipients = (recipientsRes.data ?? []) as { status: string }[]
  const sentCount    = recipients.filter(r => r.status === 'sent').length
  const failedCount  = recipients.filter(r => r.status === 'failed').length
  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const targetCount  = targetCountRes.count ?? 0

  const cfg = STATUS_CONFIG[(bc as any).status] ?? STATUS_CONFIG.draft
  const groupName  = (bc as any).classes?.wa_group_name as string | null | undefined
  const canSend    = (bc as any).status !== 'sent'
  const canSendGroup = !!(bc as any).target_class_id && !(bc as any).group_sent_at

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref="/broadcasts"
        title={(bc as any).title}
        action={<Badge color={cfg.color}>{cfg.label}</Badge>}
      />

      {/* STATISTIK — terbaca dalam 1 detik, sama seperti Event Hub */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Terkirim',        value: sentCount,    color: 'text-green-600' },
          { label: 'Gagal',           value: failedCount,  color: failedCount > 0 ? 'text-red-500' : 'text-gray-900' },
          { label: 'Belum Diproses',  value: pendingCount, color: pendingCount > 0 ? 'text-orange-500' : 'text-gray-900' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className={`text-xl font-bold leading-tight ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Section: Info */}
      <SectionList label="Info">
        <DetailRow
          icon={<MessageSquareText className="w-4 h-4" />}
          label="Judul"
          value={(bc as any).title}
          chevron={false}
        />
        <DetailRow
          icon={<Users className="w-4 h-4" />}
          label="Audience"
          value={AUDIENCE_LABEL[audience] ?? audience}
          chevron={false}
        />
        <DetailRow
          icon={<Users className="w-4 h-4" />}
          label="Jumlah Target"
          value={`${targetCount} member`}
          sublabel={recipients.length > 0 ? `${recipients.length} sudah diproses dari target ini` : undefined}
          chevron={false}
        />
      </SectionList>

      {/* Section: Preview pesan */}
      <SectionList label="Preview Pesan">
        <div className="px-4 py-3.5">
          <p className="text-xs font-semibold text-gray-400 mb-1.5">Akan tampil di WhatsApp sebagai:</p>
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
            <span className="font-bold">{(bc as any).title}</span>
            {'\n\n'}
            {(bc as any).content}
          </div>
        </div>
      </SectionList>

      {/* Section: Operasional */}
      <SectionList label="Operasional">
        <div className="px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Kirim Broadcast</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {recipients.length === 0
                ? 'Broadcast belum pernah dikirim'
                : pendingCount > 0 || failedCount > 0
                ? `${pendingCount + failedCount} member belum/gagal terkirim`
                : 'Semua target sudah terkirim'}
            </p>
          </div>
          {canSend && <BroadcastSendButton broadcastId={id} />}
        </div>
        {(bc as any).target_class_id && (
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Kirim ke Grup WA</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {(bc as any).group_sent_at
                  ? `Terkirim ke grup ${groupName ?? ''}`
                  : `Grup: ${groupName ?? '-'}`}
              </p>
            </div>
            {canSendGroup && <BroadcastGroupSendButton broadcastId={id} groupName={groupName ?? 'komunitas'} />}
          </div>
        )}
      </SectionList>

      {/* Section: Pengaturan */}
      <SectionList label="Pengaturan">
        <DetailRow
          icon={<Settings className="w-4 h-4" />}
          label="Edit Broadcast"
          sublabel={sentCount > 0 ? 'Sudah ada yang terkirim - cek dulu sebelum ubah isi' : 'Judul, isi pesan, audience'}
          href={`/broadcasts/${id}/settings`}
        />
        <div className="px-4 py-3">
          <DeleteButton
            table="broadcasts"
            id={id}
            redirectTo="/broadcasts"
            confirmText="Hapus broadcast ini? Riwayat penerima juga akan terhapus."
          />
        </div>
      </SectionList>
    </div>
  )
}
