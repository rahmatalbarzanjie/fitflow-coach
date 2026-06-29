import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  month: string // 'YYYY-MM', sudah divalidasi/di-default di page.tsx
  currentMonth: string // 'YYYY-MM' bulan ini (WIB), dihitung sekali di page.tsx
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Server Component, pola Link sama seperti STATUS_TABS di
// classes/[id]/registrations/page.tsx - filter lewat URL, tanpa client
// state. Panah "berikutnya" sengaja jadi non-link kalau sudah di bulan
// ini/masa depan - tidak ada gunanya tampilkan laporan bulan yang pasti
// kosong.
export function PeriodNav({ month, currentMonth }: Props) {
  const [y, m] = month.split('-').map(Number)
  const label = `${MONTH_NAMES[m - 1]} ${y}`
  const prevMonth = shiftMonth(month, -1)
  const nextMonth = shiftMonth(month, 1)
  const isAtOrAfterCurrent = month >= currentMonth

  return (
    <div className="flex items-center justify-between mb-4">
      <Link
        href={`?month=${prevMonth}`}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        aria-label="Bulan sebelumnya"
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      {isAtOrAfterCurrent ? (
        <span className="w-8 h-8 flex items-center justify-center text-gray-200">
          <ChevronRight className="w-4 h-4" />
        </span>
      ) : (
        <Link
          href={`?month=${nextMonth}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}
