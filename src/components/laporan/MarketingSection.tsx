interface Props {
  sentCount:    number
  failedCount:  number
  pendingCount: number
}

// Delivery rate = sent / (sent+failed) - keputusan produk terbaru
// (Phase 2 Review) menggantikan formula awal yang mengikutkan pending
// di penyebut. Pending TETAP ditampilkan sebagai baris terpisah di
// bawah, cuma tidak ikut dihitung ke rate.
export function MarketingSection({ sentCount, failedCount, pendingCount }: Props) {
  const resolved = sentCount + failedCount
  const deliveryRate = resolved > 0 ? Math.round((sentCount / resolved) * 100) : null

  const rows = [
    { label: 'Terkirim',  value: sentCount },
    { label: 'Gagal',     value: failedCount },
    { label: 'Tertunda',  value: pendingCount },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
      <div className="flex items-center justify-between px-4 py-3 bg-violet-50">
        <span className="text-sm font-semibold text-gray-700">Delivery Rate</span>
        <span className="text-sm font-bold text-violet-700">{deliveryRate !== null ? `${deliveryRate}%` : '—'}</span>
      </div>
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-700">{r.label}</span>
          <span className="text-sm font-semibold text-gray-900">{r.value}</span>
        </div>
      ))}
    </div>
  )
}
