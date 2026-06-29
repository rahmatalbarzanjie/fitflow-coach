import { Clock, CheckCircle2 } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface Props {
  pendingCount:  number
  pendingAmount: number
}

// Pola sama seperti "Perlu Perhatian" di Beranda (kartu putih, icon bulat
// berwarna, teks) - bukan section baru secara visual, cuma dipindah ke
// Laporan dengan data dari RPC get_laporan_revenue yang sudah ada
// (pending TIDAK difilter periode - "belum dikonfirmasi" adalah
// pertanyaan hari ini, bukan pertanyaan "di bulan X").
//
// Tidak ada link - belum ada halaman yang mengonsolidasi pending payment
// lintas kelas/event (tiap kelas/event punya halaman registrations
// sendiri-sendiri). Daripada link ke rute yang tidak ada, kartu ini
// murni informatif.
//
// Sengaja TIDAK disembunyikan kalau pendingCount=0 - tampilkan status
// tenang "Tidak ada pembayaran tertunda" supaya section ini tetap
// informatif, bukan kartu kosong tanpa konteks (lihat First-Run Audit:
// akun GetFuel sekarang pendingCount=0).
export function ActionSnapshot({ pendingCount, pendingAmount }: Props) {
  if (pendingCount === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        </div>
        <p className="text-sm text-gray-500">Tidak ada pembayaran tertunda</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
        <Clock className="w-4 h-4 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{pendingCount} pembayaran belum dikonfirmasi</p>
        <p className="text-xs text-gray-400 truncate">{formatRupiah(pendingAmount)} menunggu</p>
      </div>
    </div>
  )
}
