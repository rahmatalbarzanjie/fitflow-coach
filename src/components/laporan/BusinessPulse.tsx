import { TrendingUp, TrendingDown, Users, Gauge, Wallet, Clock } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface Props {
  revenueGrowthPct: number | null
  activeMemberCount: number
  avgOccupancyPct: number | null
  prepaidPct: number | null
  pendingAmount: number
}

// Business Pulse - beberapa indikator MENTAH berdampingan, BUKAN satu
// skor komposit (Business Health Score eksplisit DITOLAK - lihat KPI
// Trust Audit & Member Activity Definition Audit). Menggabungkan
// revenue growth + occupancy + member jadi satu angka cuma
// menyembunyikan dimensi mana yang sebenarnya bermasalah.
export function BusinessPulse({
  revenueGrowthPct, activeMemberCount, avgOccupancyPct, prepaidPct, pendingAmount,
}: Props) {
  const rows = [
    {
      icon: revenueGrowthPct !== null && revenueGrowthPct < 0 ? TrendingDown : TrendingUp,
      color: revenueGrowthPct !== null && revenueGrowthPct < 0 ? 'text-red-500' : 'text-green-600',
      label: 'Revenue Growth',
      value: revenueGrowthPct !== null ? `${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct}%` : 'Baru mulai',
    },
    {
      icon: Users,
      color: 'text-blue-600',
      label: 'Member Aktif',
      value: `${activeMemberCount} orang`,
    },
    {
      icon: Gauge,
      color: 'text-violet-600',
      label: 'Occupancy Rata-rata',
      value: avgOccupancyPct !== null ? `${avgOccupancyPct}%` : '—',
    },
    {
      icon: Wallet,
      color: 'text-emerald-600',
      label: 'Prepaid (Membership)',
      value: prepaidPct !== null ? `${prepaidPct}% dari revenue` : '—',
    },
    {
      icon: Clock,
      color: 'text-orange-500',
      label: 'Pending Payment',
      value: formatRupiah(pendingAmount),
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3 px-4 py-3">
          <r.icon className={`w-4 h-4 shrink-0 ${r.color}`} />
          <p className="text-sm text-gray-600 flex-1">{r.label}</p>
          <p className={`text-sm font-semibold ${r.color}`}>{r.value}</p>
        </div>
      ))}
    </div>
  )
}
