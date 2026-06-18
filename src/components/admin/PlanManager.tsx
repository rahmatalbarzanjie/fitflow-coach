'use client'

import { useState } from 'react'

interface Props {
  profileId: string
  currentPlanName: string | null
  currentMaxClasses: number | null
  currentMaxBroadcast: number | null
}

const PRESETS = [
  { key: 'starter', label: 'Starter', maxClasses: 3,    maxBroadcast: 150 },
  { key: 'pro',      label: 'Pro',     maxClasses: 10,   maxBroadcast: 600 },
  { key: 'studio',   label: 'Studio',  maxClasses: null, maxBroadcast: null },
] as const

const inp = 'w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function PlanManager({ profileId, currentPlanName, currentMaxClasses, currentMaxBroadcast }: Props) {
  const [open,         setOpen]         = useState(false)
  const [maxClasses,   setMaxClasses]   = useState(currentMaxClasses?.toString() ?? '')
  const [maxBroadcast, setMaxBroadcast] = useState(currentMaxBroadcast?.toString() ?? '')
  const [planName,     setPlanName]     = useState(currentPlanName ?? '')
  const [saving,        setSaving]       = useState(false)
  const [done,          setDone]         = useState(false)
  const [error,         setError]        = useState('')

  function applyPreset(p: typeof PRESETS[number]) {
    setPlanName(p.key)
    setMaxClasses(p.maxClasses === null ? '' : String(p.maxClasses))
    setMaxBroadcast(p.maxBroadcast === null ? '' : String(p.maxBroadcast))
  }

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/set-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        profileId,
        planName:             planName || null,
        maxActiveClasses:     maxClasses,
        maxBroadcastPerMonth: maxBroadcast,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Gagal menyimpan paket'); return }
    setDone(true)
    setOpen(false)
    setTimeout(() => { setDone(false); window.location.reload() }, 1200)
  }

  if (done) return <span className="text-xs text-green-600 font-medium">Disimpan ✓</span>

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-violet-600 hover:text-violet-800 font-medium shrink-0 ml-4"
      >
        Atur Paket
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-10 bg-white border border-gray-100 rounded-xl shadow-lg p-3 w-64 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Pilih Cepat</p>
          <div className="flex gap-1.5 mb-2">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                  planName === p.key
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {error && <p className="text-[10px] text-red-500 px-1">{error}</p>}

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 px-0.5">Max Kelas Aktif (kosong = unlimited)</label>
            <input type="number" min="0" value={maxClasses} onChange={e => setMaxClasses(e.target.value)} placeholder="Unlimited" className={inp} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 px-0.5">Max Broadcast WA/bulan (kosong = unlimited)</label>
            <input type="number" min="0" value={maxBroadcast} onChange={e => setMaxBroadcast(e.target.value)} placeholder="Unlimited" className={inp} />
          </div>

          <div className="flex gap-1.5 pt-1">
            <button onClick={() => setOpen(false)} disabled={saving} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500">
              Batal
            </button>
            <button onClick={save} disabled={saving} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium">
              Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
