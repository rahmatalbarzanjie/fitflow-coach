import { MapPin } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

export interface ClassOccupancyItem {
  id: string
  name: string
  location: string | null
  class_type: string | null
  capacity: number | null
  session_count: number
  attendance_count: number
  revenue: number
  revenue_share_pct: number
  net_revenue: number
}

interface LocationGroup {
  location: string
  classes: ClassOccupancyItem[]
  totalRevenue: number
  totalNetRevenue: number
  totalAttendance: number
  totalSessions: number
  hasRevenueSplit: boolean
}

const CLASSIFICATION = [
  { min: 80, label: 'Diminati',        color: 'bg-green-50 text-green-600' },
  { min: 50, label: 'Sehat',           color: 'bg-blue-50 text-blue-600' },
  { min: 0,  label: 'Butuh Perhatian', color: 'bg-orange-50 text-orange-600' },
] as const

function classify(pct: number) {
  return CLASSIFICATION.find(c => pct >= c.min) ?? CLASSIFICATION[CLASSIFICATION.length - 1]
}

function buildGroups(classes: ClassOccupancyItem[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>()
  for (const c of classes) {
    const key = c.location?.trim() || 'Tanpa Lokasi'
    if (!map.has(key)) {
      map.set(key, {
        location: key,
        classes: [],
        totalRevenue: 0,
        totalNetRevenue: 0,
        totalAttendance: 0,
        totalSessions: 0,
        hasRevenueSplit: false,
      })
    }
    const g = map.get(key)!
    g.classes.push(c)
    g.totalRevenue += Number(c.revenue)
    g.totalNetRevenue += Number(c.net_revenue)
    g.totalAttendance += Number(c.attendance_count)
    g.totalSessions += Number(c.session_count)
    if (c.revenue_share_pct < 100) g.hasRevenueSplit = true
  }
  // Sort groups by totalRevenue desc, then sort classes within each group
  return [...map.values()]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map(g => ({ ...g, classes: [...g.classes].sort((a, b) => b.revenue - a.revenue) }))
}

function ClassRow({ c, groupHasRevenueSplit }: { c: ClassOccupancyItem; groupHasRevenueSplit: boolean }) {
  const hasSessionData = c.session_count > 0
  const hasCapacity = c.capacity !== null && c.capacity > 0
  const occupancyPct = hasSessionData && hasCapacity
    ? Math.round((c.attendance_count / (c.capacity! * c.session_count)) * 100)
    : null
  const cls = occupancyPct !== null ? classify(occupancyPct) : null

  return (
    <div className="px-4 py-3 bg-white">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          {cls && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls.color}`}>
              {cls.label}
            </span>
          )}
          <span className="text-xs font-semibold text-gray-700 w-8 text-right">
            {occupancyPct !== null ? `${occupancyPct}%` : '—'}
          </span>
        </div>
      </div>

      {occupancyPct !== null ? (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full bg-violet-500 rounded-full"
            style={{ width: `${Math.min(100, occupancyPct)}%` }}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-1.5">
          {!hasSessionData ? 'Tidak ada data sesi' : 'Tanpa batas kapasitas'}
        </p>
      )}

      {groupHasRevenueSplit && c.revenue_share_pct < 100 ? (
        <>
          <p className="text-xs text-gray-700">
            <span className="font-semibold text-violet-700">{formatRupiah(c.net_revenue)}</span>
            {' '}bagian kamu ({c.revenue_share_pct}%) · {c.attendance_count} kehadiran
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">dari total {formatRupiah(c.revenue)}</p>
        </>
      ) : groupHasRevenueSplit ? (
        <p className="text-xs text-gray-400">
          {formatRupiah(c.revenue)} revenue · {c.attendance_count} kehadiran
        </p>
      ) : (
        <p className="text-xs text-gray-400">
          {formatRupiah(c.revenue)} revenue · {c.attendance_count} kehadiran
        </p>
      )}
    </div>
  )
}

export function ClassOccupancyByLocation({ classes }: { classes: ClassOccupancyItem[] }) {
  if (classes.length === 0) return null

  const groups = buildGroups(classes)

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.location} className="rounded-2xl border border-gray-100 overflow-hidden">

          {/* Location header */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-gray-800 truncate">{g.location}</p>
              </div>
              <div className="text-right shrink-0">
                {g.hasRevenueSplit ? (
                  <>
                    <p className="text-sm font-bold text-violet-700">{formatRupiah(g.totalNetRevenue)}</p>
                    <p className="text-[11px] text-gray-400">dari {formatRupiah(g.totalRevenue)}</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-gray-900">{formatRupiah(g.totalRevenue)}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
              <span>{g.totalSessions} sesi</span>
              <span>·</span>
              <span>{g.totalAttendance} kehadiran total</span>
              {g.classes.length > 1 && (
                <>
                  <span>·</span>
                  <span>{g.classes.length} kelas</span>
                </>
              )}
            </div>
          </div>

          {/* Class list */}
          <div className="divide-y divide-gray-50">
            {g.classes.map(c => (
              <ClassRow key={c.id} c={c} groupHasRevenueSplit={g.hasRevenueSplit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
