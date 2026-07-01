'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'

interface Health {
  queued:                  number
  processing:              number
  failed:                  number
  retrying:                number
  recovered_from_timeout:  number
  max_attempts_reached:    number
  top_url_messages:        Array<{ contact_name: string | null; contact_phone: string; url_count: number; message_type: string }>
}

export function WaQueueHealth() {
  const [health, setHealth]   = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/wa/queue-health')
      const data = await res.json()
      if (res.ok) setHealth(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return null

  const hasWarning = (health?.failed ?? 0) > 0 ||
    (health?.max_attempts_reached ?? 0) > 0 ||
    (health?.recovered_from_timeout ?? 0) > 0

  const allClear = !hasWarning && (health?.queued ?? 0) === 0

  return (
    <div className="mt-8 border-t border-gray-100 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Kesehatan Antrian WA</h2>
        <button
          onClick={load}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Perbarui
        </button>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <HealthCard label="Dalam Antrian" value={health?.queued ?? 0} color="indigo" />
        <HealthCard label="Sedang Diproses" value={health?.processing ?? 0} color="amber" />
        <HealthCard label="Gagal" value={health?.failed ?? 0} color="red" />
        <HealthCard label="Menunggu Retry" value={health?.retrying ?? 0} color="orange" />
      </div>

      {/* Warnings */}
      {hasWarning && (
        <div className="space-y-2 mb-4">
          {(health?.failed ?? 0) > 0 && (
            <Warning>
              {health?.failed} pesan gagal dikirim. Cek <span className="font-medium">Status: Gagal</span> di atas untuk detail.
            </Warning>
          )}
          {(health?.max_attempts_reached ?? 0) > 0 && (
            <Warning>
              {health?.max_attempts_reached} pesan mencapai batas retry (7 hari terakhir) dan tidak akan dikirim ulang.
            </Warning>
          )}
          {(health?.recovered_from_timeout ?? 0) > 0 && (
            <Warning>
              {health?.recovered_from_timeout} pesan sempat terjebak di antrian dan di-recover otomatis (7 hari terakhir).
              Ini normal jika terjadi sesekali.
            </Warning>
          )}
        </div>
      )}

      {/* All clear */}
      {allClear && (
        <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 rounded-xl p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Antrian WA bersih. Tidak ada pesan yang gagal atau tertahan.
        </div>
      )}

      {/* Top URL messages */}
      {(health?.top_url_messages?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">
            Pesan URL Terbanyak (7 hari)
          </p>
          <div className="space-y-1.5">
            {health!.top_url_messages.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-amber-50 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{m.contact_name ?? m.contact_phone}</span>
                <span className="text-gray-400">·</span>
                <span className="font-medium text-amber-600">{m.url_count} URL</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HealthCard({ label, value, color }: { label: string; value: number; color: 'indigo' | 'amber' | 'red' | 'orange' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700',
    amber:  'bg-amber-50  text-amber-700',
    red:    value > 0 ? 'bg-red-50    text-red-700'    : 'bg-gray-50 text-gray-400',
    orange: value > 0 ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-400',
  }
  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-wide font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}
