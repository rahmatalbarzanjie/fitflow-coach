'use client'

import { ArrowUpRight, ArrowDownLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

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

function formatTs(ts: string): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  rows:      Record<string, any>[]
  total:     number
  page:      number
  pageSize:  number
  loading:   boolean
  onSelect:  (row: Record<string, any>) => void
  onPage:    (p: number) => void
}

export function WaActivityList({ rows, total, page, pageSize, loading, onSelect, onPage }: Props) {
  const totalPages = Math.ceil(total / pageSize)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat...
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        Tidak ada pesan ditemukan dengan filter ini.
      </div>
    )
  }

  return (
    <div>
      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {rows.map(row => (
          <button
            key={row.id}
            onClick={() => onSelect(row)}
            className="w-full text-left bg-white border border-gray-100 rounded-xl p-3 hover:border-indigo-200 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{row.contact_name ?? row.contact_phone}</p>
                <p className="text-[10px] text-gray-400 truncate">{row.contact_phone}</p>
              </div>
              <StatusBadge success={row.success} />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <DirectionBadge direction={row.direction} />
              <TypeBadge type={row.message_type} />
              <span className="text-[10px] text-gray-400 ml-auto">{formatTs(row.created_at)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-medium pr-4">Waktu</th>
              <th className="pb-2 font-medium pr-4">Kontak</th>
              <th className="pb-2 font-medium pr-4">Arah</th>
              <th className="pb-2 font-medium pr-4">Jenis</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(row => (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{formatTs(row.created_at)}</td>
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-gray-900">{row.contact_name ?? '-'}</p>
                  <p className="text-gray-400">{row.contact_phone}</p>
                </td>
                <td className="py-2.5 pr-4"><DirectionBadge direction={row.direction} /></td>
                <td className="py-2.5 pr-4"><TypeBadge type={row.message_type} /></td>
                <td className="py-2.5"><StatusBadge success={row.success} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <span>{total} pesan · halaman {page} dari {totalPages}</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DirectionBadge({ direction }: { direction: string }) {
  return direction === 'outbound'
    ? <span className="flex items-center gap-0.5 text-indigo-600 font-medium"><ArrowUpRight className="w-3 h-3" />Keluar</span>
    : <span className="flex items-center gap-0.5 text-emerald-600 font-medium"><ArrowDownLeft className="w-3 h-3" />Masuk</span>
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
      {TYPE_LABEL[type] ?? type}
    </span>
  )
}

function StatusBadge({ success }: { success: boolean }) {
  return success
    ? <span className="inline-block px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 text-[10px] font-medium">Terkirim</span>
    : <span className="inline-block px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-medium">Gagal</span>
}
