'use client'

import { X, ArrowUpRight, ArrowDownLeft, Link as LinkIcon } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  registration: 'Pendaftaran Kelas',
  event:        'Pendaftaran Event',
  broadcast:    'Broadcast',
  community:    'Undangan Komunitas',
  feedback:     'Permintaan Feedback',
  chatbot:      'Chatbot',
  reminder:     'Pengingat',
  manual:       'Manual',
  system:       'Sistem',
}

const SOURCE_LABEL: Record<string, string> = {
  '/api/notifications/class-registration':  'Pendaftaran Kelas',
  '/api/notifications/event-registration':  'Pendaftaran Event',
  '/api/notifications/registration':        'Aksi Instruktur',
  '/api/community/invite':                  'Undangan Komunitas',
  '/api/feedback/request':                  'Feedback Kelas',
  '/api/feedback/request-event':            'Feedback Event',
  '/api/wa/incoming':                       'Chatbot',
}

function sourceLabel(route: string | null): string {
  if (!route) return '-'
  // Broadcast source_route menyertakan ID: /api/broadcasts/{id}/send
  if (route.includes('/api/broadcasts/') && route.endsWith('/send')) return 'Broadcast'
  if (route.includes('/api/broadcasts/') && route.endsWith('/send-group')) return 'Broadcast Grup'
  return SOURCE_LABEL[route] ?? route
}

interface Props {
  row:     Record<string, any>
  onClose: () => void
}

export function WaActivityDetail({ row, onClose }: Props) {
  const isOutbound = row.direction === 'outbound'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{row.contact_name ?? '-'}</p>
            <p className="text-xs text-gray-400">{row.contact_phone}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Isi pesan */}
        <div className="p-4 space-y-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Isi Pesan</p>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-mono text-[11px]">
              {row.message_content}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <MetaRow label="Waktu" value={formatTs(row.created_at)} />
            <MetaRow
              label="Arah"
              value={
                <span className={`flex items-center gap-1 font-medium ${isOutbound ? 'text-indigo-600' : 'text-emerald-600'}`}>
                  {isOutbound ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                  {isOutbound ? 'Keluar' : 'Masuk'}
                </span>
              }
            />
            <MetaRow label="Jenis" value={TYPE_LABEL[row.message_type] ?? row.message_type} />
            <MetaRow
              label="Status"
              value={
                <span className={`font-medium ${row.success ? 'text-green-600' : 'text-red-500'}`}>
                  {row.success ? 'Terkirim' : 'Gagal'}
                </span>
              }
            />
            <MetaRow
              label="Mengandung URL"
              value={
                row.contains_url
                  ? <span className="flex items-center gap-1 text-amber-600"><LinkIcon className="w-3 h-3" /> Ya ({row.url_count})</span>
                  : 'Tidak'
              }
            />
            <MetaRow label="Panjang" value={`${row.character_count} karakter`} />
            <MetaRow label="Sumber" value={sourceLabel(row.source_route)} />
            {row.queue_delay_seconds != null && (
              <MetaRow label="Jeda Antrian" value={`${row.queue_delay_seconds} detik`} />
            )}
            {!row.success && row.error_message && (
              <div className="col-span-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Pesan Error</p>
                <p className="text-red-500 text-xs bg-red-50 rounded-lg p-2">{row.error_message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <div className="text-gray-700 mt-0.5">{value}</div>
    </div>
  )
}

function formatTs(ts: string): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
