import { formatRupiah } from '@/lib/utils'

interface ClassOccupancy {
  id:               string
  name:             string
  capacity:         number | null
  session_count:    number
  attendance_count: number
  revenue:          number
}

interface Props {
  classes: ClassOccupancy[]
}

// Cutoff terkunci (keputusan produk, Phase 2 Review): >=80% Diminati,
// 50-79% Sehat, <50% Butuh Perhatian. Tetap murni klasifikasi tampilan -
// tidak ada apa pun yang disimpan.
const CLASSIFICATION = [
  { min: 80, label: 'Diminati',         color: 'bg-green-50 text-green-600' },
  { min: 50, label: 'Sehat',            color: 'bg-blue-50 text-blue-600' },
  { min: 0,  label: 'Butuh Perhatian',  color: 'bg-orange-50 text-orange-600' },
] as const

function classify(pct: number) {
  return CLASSIFICATION.find(c => pct >= c.min) ?? CLASSIFICATION[CLASSIFICATION.length - 1]
}

// Satu baris per kelas berisi SEMUA metrik (revenue, kehadiran, occupancy) -
// sengaja DIGABUNG, bukan 3 list terpisah (occupancy / top revenue / top
// kehadiran) seperti versi sebelumnya. Untuk studio kecil (cth. 3 kelas),
// 3 list terpisah cuma menampilkan kelas yang SAMA 3x dengan urutan beda -
// nol insight baru, cuma menambah panjang scroll (temuan UX audit T2.1).
//
// session_count=0 BISA berarti "memang tidak ada sesi" ATAU "sesi
// historis belum pernah di-generate" (sessions cuma rolling-forward 56
// hari, tidak ada backfill - lihat src/app/api/sessions/auto-fill).
// Tidak mungkin dibedakan dari data yang ada, jadi pesannya netral:
// "Tidak ada data sesi", BUKAN "0% occupancy" yang menyesatkan.
export function ClassOccupancyList({ classes }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
      {classes.map(c => {
        const hasSessionData = c.session_count > 0
        const hasCapacity = c.capacity !== null && c.capacity > 0
        const occupancyPct = hasSessionData && hasCapacity
          ? Math.round((c.attendance_count / (c.capacity! * c.session_count)) * 100)
          : null

        return (
          <div key={c.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                {occupancyPct !== null && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${classify(occupancyPct).color}`}>
                    {classify(occupancyPct).label}
                  </span>
                )}
                <span className="text-xs font-semibold text-gray-900">
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
                {!hasSessionData
                  ? 'Tidak ada data sesi untuk periode ini'
                  : 'Tanpa batas kapasitas'}
              </p>
            )}
            <p className="text-xs text-gray-400">
              {formatRupiah(c.revenue)} revenue · {c.attendance_count} kehadiran
            </p>
          </div>
        )
      })}
    </div>
  )
}
