interface Props {
  classUsed:      number
  classLimit:     number | null
  broadcastUsed:  number
  broadcastLimit: number | null
  subscriptionLabel: string
  subscriptionSub:   string
}

// Murni reuse - angka kuota dari checkClassQuota/checkBroadcastQuota
// (src/lib/quota.ts, sudah dipakai untuk ENFORCEMENT), formula trial
// dari getSubscriptionLabel (settings/subscription/page.tsx). Tidak
// ada logika baru di sini, cuma menampilkan apa yang sudah dihitung
// di tempat lain untuk tujuan lain.
export function OperationalSection({
  classUsed, classLimit, broadcastUsed, broadcastLimit, subscriptionLabel, subscriptionSub,
}: Props) {
  const rows = [
    { label: 'Kelas Aktif',  value: classLimit !== null ? `${classUsed} / ${classLimit}` : `${classUsed} (tanpa batas)` },
    { label: 'Broadcast Bulan Ini', value: broadcastLimit !== null ? `${broadcastUsed} / ${broadcastLimit}` : `${broadcastUsed} (tanpa batas)` },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-700">{r.label}</span>
          <span className="text-sm font-semibold text-gray-900">{r.value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-gray-700">Status Langganan</span>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{subscriptionLabel}</p>
          <p className="text-xs text-gray-400">{subscriptionSub}</p>
        </div>
      </div>
    </div>
  )
}
