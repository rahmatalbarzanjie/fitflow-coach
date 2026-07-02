import Link from 'next/link'
import { formatTime, formatRupiah } from '@/lib/utils'

// ── Types (exported so page.tsx can build the items array) ────────────────────

export interface TodayItem {
  kind: 'class' | 'event'
  id: string
  slug: string
  name: string
  description?: string | null
  startTime: string
  endTime: string
  location: string | null
  mapsUrl?: string | null
  capacity: number | null
  bookedCount: number
  badge?: 'rescheduled' | 'extra'
  type?: string           // class type key, for accent color
  price?: number          // class_price or event price (0 = free / membership)
  registerUrl: string     // pre-built, includes ?date= when needed
}

interface Props {
  items: TodayItem[]
  todayLabel: string      // e.g. "Rabu, 2 Juli 2026"
}

// ── Accent colors per class type ──────────────────────────────────────────────

const TYPE_ACCENT: Record<string, { text: string; bg: string; bar: string }> = {
  poundfit: { text: 'text-red-500',     bg: 'bg-red-50',      bar: 'bg-red-400'    },
  barre:    { text: 'text-rose-600',    bg: 'bg-rose-50',     bar: 'bg-rose-400'   },
  zumba:    { text: 'text-teal-600',    bg: 'bg-teal-50',     bar: 'bg-teal-400'   },
  yoga:     { text: 'text-emerald-600', bg: 'bg-emerald-50',  bar: 'bg-emerald-400'},
  pilates:  { text: 'text-sky-600',     bg: 'bg-sky-50',      bar: 'bg-sky-400'    },
  aerobic:  { text: 'text-amber-600',   bg: 'bg-amber-50',    bar: 'bg-amber-400'  },
}
const DEFAULT_ACCENT = { text: 'text-violet-600', bg: 'bg-violet-50', bar: 'bg-violet-400' }
const EVENT_ACCENT   = { text: 'text-indigo-600', bg: 'bg-indigo-50', bar: 'bg-indigo-400' }

function accent(item: TodayItem) {
  if (item.kind === 'event') return EVENT_ACCENT
  return TYPE_ACCENT[item.type?.toLowerCase() ?? ''] ?? DEFAULT_ACCENT
}

// ── Single card ───────────────────────────────────────────────────────────────

function TodayCard({ item }: { item: TodayItem }) {
  const ac     = accent(item)
  const isFull = item.capacity !== null && item.bookedCount >= item.capacity
  const pct    = item.capacity ? Math.min(100, Math.round((item.bookedCount / item.capacity) * 100)) : 0

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:-translate-y-1 transition-transform duration-300">
      <div className="p-5">

        {/* Badges row */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col gap-1.5">
            {item.kind === 'event' ? (
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 font-bold rounded-lg text-xs uppercase tracking-wider self-start">
                Event
              </span>
            ) : (
              <span className={`px-3 py-1 ${ac.bg} ${ac.text} font-bold rounded-lg text-xs uppercase tracking-wider self-start`}>
                Hari Ini
              </span>
            )}
            {item.badge === 'rescheduled' && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium self-start">
                ⚠️ Jadwal Berubah
              </span>
            )}
            {item.badge === 'extra' && (
              <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium self-start">
                ⚡ Kelas Ekstra
              </span>
            )}
          </div>
          {item.capacity && (
            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-medium">
              Maks {item.capacity}
            </span>
          )}
        </div>

        {/* Name + description */}
        <h4 className="font-montserrat text-lg font-bold text-gray-900 mb-1">{item.name}</h4>
        {item.description && (
          <p className="text-xs text-gray-400 leading-relaxed mb-2 line-clamp-2">{item.description}</p>
        )}

        {/* Time */}
        <p className={`text-sm flex items-center gap-1.5 mb-1 ${ac.text}`}>
          <span className="material-symbols-outlined text-base">schedule</span>
          {formatTime(item.startTime)} – {formatTime(item.endTime)}
        </p>

        {/* Location */}
        {item.location && (
          <p className="text-gray-500 text-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">location_on</span>
            {item.location}
            {item.mapsUrl && (
              <a
                href={item.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-semibold ml-1 ${ac.text} hover:underline`}
              >
                Lihat Lokasi
              </a>
            )}
          </p>
        )}

        {/* Price */}
        {item.price && item.price > 0 && (
          <p className={`text-sm font-bold mt-2 ${ac.text}`}>
            {formatRupiah(item.price)}
            <span className="text-gray-400 font-normal text-xs"> / sesi</span>
          </p>
        )}

        {/* Quota bar */}
        {item.capacity !== null && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>{item.bookedCount} dari {item.capacity} kuota</span>
              {isFull && <span className="text-red-500 font-semibold">Penuh</span>}
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isFull ? 'bg-red-400' : ac.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        {isFull ? (
          <div className="mt-3 w-full py-2.5 rounded-xl text-center text-sm font-bold text-gray-400 bg-gray-100">
            Pendaftaran Penuh
          </div>
        ) : (
          <Link
            href={item.registerUrl}
            className={`mt-3 w-full flex items-center justify-center gap-1.5 ${ac.bg} ${ac.text} font-bold py-2.5 rounded-xl text-sm hover:opacity-80 transition-opacity`}
          >
            Daftar Kelas
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export function TodaySchedule({ items, todayLabel }: Props) {
  if (items.length === 0) return null

  return (
    <section id="jadwal-hari-ini" className="py-10 bg-white border-b border-gray-100">
      <div className="max-w-container-max mx-auto px-4 md:px-10">

        {/* Header */}
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="font-montserrat text-2xl font-bold text-gray-900">Jadwal Hari Ini</h2>
          <p className="text-sm text-gray-400">{todayLabel}</p>
        </div>

        {/* Card grid — same layout as main schedule section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <TodayCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
