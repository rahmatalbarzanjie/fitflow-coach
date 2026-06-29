import { TrendingUp, TrendingDown, Users, CheckSquare } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface Props {
  revenue:         number
  previousRevenue: number
  memberNew:       number
  attendanceCount: number
}

// Visual SAMA seperti blok "BULAN INI" di Beranda (grid-cols-3 gap-2,
// kartu putih rounded-2xl, icon+value+label center) - dipertahankan
// persis supaya Laporan dan Beranda terasa satu produk, bukan dua
// gaya beda.
export function SummaryCards({ revenue, previousRevenue, memberNew, attendanceCount }: Props) {
  let growthLabel: string | null = null
  let growthUp = true
  if (previousRevenue > 0) {
    const pct = Math.round(((revenue - previousRevenue) / previousRevenue) * 100)
    growthUp = pct >= 0
    growthLabel = `${growthUp ? '+' : ''}${pct}%`
  } else if (revenue > 0) {
    growthLabel = 'Baru mulai'
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3.5 text-center">
        <TrendingUp className="w-4 h-4 mx-auto mb-1.5 text-green-600" />
        <p className="text-sm font-bold text-green-600 leading-tight">{formatRupiah(revenue)}</p>
        {growthLabel && (
          <p className={`text-[10px] font-medium mt-0.5 flex items-center justify-center gap-0.5 ${growthUp ? 'text-green-600' : 'text-red-500'}`}>
            {growthLabel !== 'Baru mulai' && (growthUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />)}
            {growthLabel}
          </p>
        )}
        <p className="text-[10px] text-gray-400 mt-0.5">Revenue</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3.5 text-center">
        <Users className="w-4 h-4 mx-auto mb-1.5 text-blue-600" />
        <p className="text-lg font-bold text-blue-600">{memberNew}</p>
        <p className="text-[10px] text-gray-400">orang</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Paket Member Baru</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3.5 text-center">
        <CheckSquare className="w-4 h-4 mx-auto mb-1.5 text-violet-600" />
        <p className="text-lg font-bold text-violet-600">{attendanceCount}</p>
        <p className="text-[10px] text-gray-400">orang</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Kehadiran</p>
      </div>
    </div>
  )
}
