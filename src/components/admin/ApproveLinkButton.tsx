'use client'

import { useState } from 'react'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  profileId: string
}

const PLAN_OPTIONS = [
  { value: 'lite',        label: 'Lite (1.000 pesan/bln)'        },
  { value: 'regular',     label: 'Regular (10.000 pesan/bln)'    },
  { value: 'regular_pro', label: 'Regular Pro (25.000 pesan/bln)' },
  { value: 'super',       label: 'Super'                          },
  { value: 'master',      label: 'Master'                         },
  { value: 'ultra',       label: 'Ultra'                          },
]

export function ApproveLinkButton({ profileId }: Props) {
  const [open,    setOpen]    = useState(false)
  const [plan,    setPlan]    = useState('lite')
  const [months,  setMonths]  = useState('1')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [warning, setWarning] = useState('')
  const [error,   setError]   = useState('')

  async function approve() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/wa/approve-link', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profileId, plan, durationMonths: Number(months) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Gagal verifikasi'); return }
    setDone(true)
    if (data.warning) setWarning(data.warning)
    setTimeout(() => window.location.reload(), 2000)
  }

  if (done) {
    return (
      <div className="text-right">
        <span className="flex items-center justify-end gap-1 text-xs text-green-600 font-medium">
          <CheckCircle className="w-3.5 h-3.5" /> Device terhubung
        </span>
        {warning && <p className="text-[10px] text-amber-600 max-w-[200px] mt-1">{warning}</p>}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-8 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
      >
        Verifikasi & Sambungkan
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <select value={plan} onChange={e => setPlan(e.target.value)} className="h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white">
        {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <div className="flex gap-1.5">
        <select value={months} onChange={e => setMonths(e.target.value)} className="h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white">
          <option value="1">1 bulan</option>
          <option value="3">3 bulan</option>
          <option value="12">12 bulan</option>
        </select>
        <button
          onClick={approve}
          disabled={loading}
          className="flex items-center gap-1 h-8 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Konfirmasi'}
        </button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-red-500 max-w-[200px] text-right">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
