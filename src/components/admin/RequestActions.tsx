'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Props {
  requestId: string
  name:      string
  email:     string
  phone:     string
}

export function RequestActions({ requestId, name, email, phone }: Props) {
  const [loading, setLoading] = useState<'confirm' | 'reject' | null>(null)
  const [done,    setDone   ] = useState<'confirmed' | 'rejected' | null>(null)
  const [error,   setError  ] = useState('')

  async function confirm() {
    setLoading('confirm')
    setError('')
    const res  = await fetch('/api/admin/confirm-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requestId }),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) { setError(data.error); return }
    setDone('confirmed')
    setTimeout(() => window.location.reload(), 1500)
  }

  async function reject() {
    if (!confirm(`Tolak pendaftaran dari ${name}?`)) return
    setLoading('reject')
    setError('')
    const res  = await fetch('/api/admin/reject-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requestId }),
    })
    setLoading(null)
    if (!res.ok) { setError('Gagal menolak'); return }
    setDone('rejected')
    setTimeout(() => window.location.reload(), 1000)
  }

  if (done === 'confirmed') return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle className="w-3.5 h-3.5" /> Dikonfirmasi — WA terkirim
    </span>
  )
  if (done === 'rejected') return (
    <span className="text-xs text-gray-400">Ditolak</span>
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          onClick={confirm}
          disabled={!!loading}
          className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading === 'confirm'
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <CheckCircle className="w-3 h-3" />}
          Konfirmasi
        </button>
        <button
          onClick={reject}
          disabled={!!loading}
          className="flex items-center gap-1 h-7 px-2 text-xs text-red-500 border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading === 'reject'
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <XCircle className="w-3 h-3" />}
          Tolak
        </button>
      </div>
      {error && <p className="text-[10px] text-red-500 max-w-[180px] text-right">{error}</p>}
    </div>
  )
}
