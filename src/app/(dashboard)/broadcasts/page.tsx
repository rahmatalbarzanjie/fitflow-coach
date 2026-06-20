import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Send, FileText, Clock, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDateShort } from '@/lib/utils'

const AUDIENCE_LABEL: Record<string, string> = {
  all:      'Semua Member',
  active:   'Member Aktif',
  at_risk:  'Perlu Follow Up',
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
    .select('id, title, target_audience, status, recipient_count, sent_at, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as any)

  const { data: broadcasts } = await query

  return (
    <div className="w-full max-w-2xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Broadcast</h1>
          <p className="text-sm text-gray-400 mt-0.5">{broadcasts?.length ?? 0} pesan</p>
        </div>
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
          <p className="text-xs text-gray-400">Tap tombol + untuk kirim pesan ke member kamu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {broadcasts.map(bc => {
            const cfg = STATUS_CONFIG[bc.status as keyof typeof STATUS_CONFIG]
            return (
              <Link
                key={bc.id}
                href={`/broadcasts/${bc.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 hover:border-violet-100 transition-colors px-4 py-3.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{bc.title}</p>
                    <Badge color={cfg?.color ?? 'gray'}>{cfg?.label ?? bc.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                    <span>{AUDIENCE_LABEL[bc.target_audience] ?? bc.target_audience}</span>
                    <span>·</span>
                    <span>
                      {bc.status === 'sent' && bc.sent_at
                        ? `Terkirim ${formatDateShort(bc.sent_at)} · ${bc.recipient_count ?? 0} penerima`
                        : `Dibuat ${formatDateShort(bc.created_at ?? new Date().toISOString())}`}
                    </span>
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Floating action - konsisten dengan posisi "buat baru" di modul lain,
          tapi mengambang karena broadcast adalah aksi utama yang dipakai
          paling sering oleh instruktur. */}
      <Link
        href="/broadcasts/new"
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-30 flex items-center gap-2 h-12 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg shadow-violet-600/30 text-sm font-semibold transition-colors"
        aria-label="Buat broadcast baru"
      >
        <Plus className="w-5 h-5" />
        Broadcast
      </Link>
    </div>
  )
}
