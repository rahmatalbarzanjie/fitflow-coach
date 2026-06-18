import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Send, FileText, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { BroadcastSendButton } from '@/components/broadcasts/BroadcastSendButton'
import { BroadcastGroupSendButton } from '@/components/broadcasts/BroadcastGroupSendButton'
import { formatDateShort } from '@/lib/utils'

const AUDIENCE_LABEL: Record<string, string> = {
  all:      'Semua Member',
  active:   'Member Aktif',
  at_risk:  'Perlu Perhatian',
  inactive: 'Tidak Aktif',
  new:      'Member Baru',
}

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'gray'   as const, icon: FileText },
  sent:      { label: 'Terkirim',  color: 'green'  as const, icon: Send     },
  scheduled: { label: 'Terjadwal', color: 'blue'   as const, icon: Clock    },
}

const STATUS_TABS = [
  { key: '',      label: 'Semua'    },
  { key: 'draft', label: 'Draft'    },
  { key: 'sent',  label: 'Terkirim' },
]

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = '' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('broadcasts')
    .select('id, title, content, target_audience, status, recipient_count, sent_at, created_at, target_class_id, group_sent_at, classes(wa_group_name)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as any)

  const { data: broadcasts } = await query

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Broadcast</h1>
          <p className="text-sm text-gray-400 mt-0.5">{broadcasts?.length ?? 0} pesan</p>
        </div>
        <Link
          href="/broadcasts/new"
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Buat Pesan
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(tab => (
          <Link
            key={tab.key}
            href={tab.key ? `/broadcasts?status=${tab.key}` : '/broadcasts'}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!broadcasts?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Send className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Belum ada broadcast</p>
          <p className="text-xs text-gray-400 mb-4">Kirim pesan ke member kamu sekarang</p>
          <Link href="/broadcasts/new" className="text-sm text-violet-600 font-medium hover:underline">
            + Buat pesan broadcast
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {broadcasts.map(bc => {
            const cfg = STATUS_CONFIG[bc.status as keyof typeof STATUS_CONFIG]
            const groupName = (bc as any).classes?.wa_group_name as string | null | undefined
            return (
              <div key={bc.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{bc.title}</p>
                      <Badge color={cfg?.color ?? 'gray'}>{cfg?.label ?? bc.status}</Badge>
                      <Badge color="violet">{AUDIENCE_LABEL[bc.target_audience] ?? bc.target_audience}</Badge>
                      {(bc as any).target_class_id && (
                        <Badge color={(bc as any).group_sent_at ? 'green' : 'blue'}>
                          {(bc as any).group_sent_at ? 'Terkirim ke grup' : `Grup: ${groupName ?? '-'}`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{bc.content}</p>
                    <p className="text-xs text-gray-300 mt-2">
                      {bc.status === 'sent' && bc.sent_at
                        ? `Terkirim ${formatDateShort(bc.sent_at!)} · ${bc.recipient_count ?? 0} penerima`
                        : `Dibuat ${formatDateShort(bc.created_at ?? new Date().toISOString())}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {bc.status === 'draft' && (
                      <BroadcastSendButton broadcastId={bc.id} />
                    )}
                    {(bc as any).target_class_id && !(bc as any).group_sent_at && (
                      <BroadcastGroupSendButton broadcastId={bc.id} groupName={groupName ?? 'komunitas'} />
                    )}
                    <DeleteButton
                      table="broadcasts"
                      id={bc.id}
                      redirectTo="/broadcasts"
                      confirmText="Hapus broadcast ini?"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
