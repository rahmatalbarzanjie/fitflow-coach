'use client'

interface Stats {
  total:         number
  sent:          number
  failed:        number
  inbound:       number
  outbound:      number
  with_url:      number
}

interface Props {
  stats: Stats
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function WaActivityStats({ stats }: Props) {
  const failRate = stats.total > 0
    ? Math.round((stats.failed / stats.total) * 100)
    : 0

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
      <StatCard label="Total" value={stats.total} />
      <StatCard label="Terkirim" value={stats.sent} />
      <StatCard label="Gagal" value={stats.failed} sub={`${failRate}%`} />
      <StatCard label="Masuk" value={stats.inbound} />
      <StatCard label="Keluar" value={stats.outbound} />
      <StatCard label="Mengandung URL" value={stats.with_url} />
    </div>
  )
}
