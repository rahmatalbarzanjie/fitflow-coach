'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { CalendarDays, Users, MapPin, ChevronRight, Copy, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EVENT_STATUS } from '@/lib/constants'

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'blue' | 'red'> = {
  draft: 'gray', published: 'green', completed: 'blue', cancelled: 'red',
}

const STATUS_TABS = [
  { key: '',          label: 'Semua'   },
  { key: 'published', label: 'Aktif'   },
  { key: 'draft',     label: 'Draft'   },
  { key: 'completed', label: 'Selesai' },
]

interface EventItem {
  id:            string
  title:         string
  slug:          string
  event_date:    string
  start_time:    string
  location:      string | null
  status:        string
  registrations: { id: string; payment_status: string }[]
}

interface Props {
  events:     EventItem[]
  publicBase: string | null
}

export function EventsList({ events, publicBase }: Props) {
  const [statusFilter, setStatusFilter] = useState('')
  const [copiedId,     setCopiedId    ] = useState<string | null>(null)

  async function copyUrl(url: string, evId: string) {
    await navigator.clipboard.writeText(url)
    setCopiedId(evId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = useMemo(() =>
    statusFilter ? events.filter(e => e.status === statusFilter) : events
  , [events, statusFilter])

  return (
    <div>
      {/* Filter pills — client-side, tidak reload */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              statusFilter === tab.key
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarDays className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {statusFilter ? 'Tidak ada event dengan status ini' : 'Belum ada event'}
          </p>
          {!statusFilter && (
            <p className="text-xs text-gray-400">Buat workshop atau event khusus pertamamu</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ev => {
            const regs      = Array.isArray(ev.registrations) ? ev.registrations : []
            const total     = regs.length
            const pending   = regs.filter(r => r.payment_status === 'pending').length
            const confirmed = regs.filter(r => r.payment_status === 'confirmed').length
            const regLink   = publicBase && ev.status === 'published'
              ? `${publicBase}/daftar/${ev.slug}`
              : null

            return (
              <div key={ev.id} className="bg-white rounded-2xl border border-gray-100 hover:border-violet-100 transition-colors">
                <Link href={`/events/${ev.id}`} className="flex items-center gap-3 px-4 py-3">
                  {/* Tanggal box */}
                  <div className="w-11 h-11 rounded-xl bg-violet-50 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-violet-500 uppercase leading-none">
                      {new Date(ev.event_date + 'T00:00').toLocaleDateString('id', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold text-violet-700 leading-tight">
                      {new Date(ev.event_date + 'T00:00').getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 truncate">{ev.title}</p>
                      <Badge color={STATUS_COLOR[ev.status] ?? 'gray'}>
                        {EVENT_STATUS[ev.status as keyof typeof EVENT_STATUS]?.label ?? ev.status}
                      </Badge>
                      {pending > 0 && (
                        <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                          {pending} menunggu
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {total} daftar · {confirmed} konfirmasi
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ev.location}
                        </span>
                      )}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>

                {/* Copy URL publik — tanpa perlu buka detail */}
                {regLink && (
                  <div className="px-4 pb-3 border-t border-gray-50 flex items-center gap-2 pt-2">
                    <p className="text-xs text-gray-400 font-mono flex-1 truncate">{regLink}</p>
                    <button
                      onClick={() => copyUrl(regLink, ev.id)}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 shrink-0 font-medium"
                    >
                      {copiedId === ev.id
                        ? <><Check className="w-3 h-3 text-green-500" /> <span className="text-green-500">Tersalin!</span></>
                        : <><Copy className="w-3 h-3" /> Salin URL</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
