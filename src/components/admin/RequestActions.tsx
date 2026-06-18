'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, MessageCircle, AlertCircle } from 'lucide-react'

interface Props {
  requestId: string
  name:      string
  email:     string
  phone:     string
}

type State = 'idle' | 'confirming-reject' | 'loading-confirm' | 'loading-reject' | 'confirmed' | 'rejected'

export function RequestActions({ requestId, name }: Props) {
  const [state,  setState ] = useState<State>('idle')
  const [waOk,   setWaOk  ] = useState<boolean | null>(null)
  const [error,  setError  ] = useState('')

  async function confirm() {
    setState('loading-confirm')
    setError('')
    const res  = await fetch('/api/admin/confirm-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requestId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Gagal mengkonfirmasi')
      setState('idle')
      return
    }
    setWaOk(data.waOk)
    setState('confirmed')
    setTimeout(() => window.location.reload(), 2000)
  }

  async function reject() {
    setState('loading-reject')
    setError('')
    const res  = await fetch('/api/admin/reject-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requestId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Gagal menolak')
      setState('idle')
      return
    }
    setWaOk(data.waOk)
    setState('rejected')
    setTimeout(() => window.location.reload(), 1500)
  }

  if (state === 'confirmed') return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle className="w-3.5 h-3.5" /> Dikonfirmasi
      </span>
      <span className={`flex items-center gap-1 text-[10px] ${waOk ? 'text-green-500' : 'text-orange-500'}`}>
        <MessageCircle className="w-3 h-3" />
        {waOk ? 'WA terkirim' : 'WA gagal - kirim manual'}
      </span>
    </div>
  )

  if (state === 'rejected') return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className="text-xs text-gray-400">Ditolak</span>
      {waOk !== null && (
        <span className={`flex items-center gap-1 text-[10px] ${waOk ? 'text-green-500' : 'text-orange-500'}`}>
          <MessageCircle className="w-3 h-3" />
          {waOk ? 'WA terkirim' : 'WA gagal'}
        </span>
      )}
    </div>
  )

  if (state === 'confirming-reject') return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <p className="text-xs text-gray-600 text-right max-w-[160px]">Tolak pendaftaran dari <strong>{name}</strong>?</p>
      <div className="flex gap-1.5">
        <button
          onClick={() => setState('idle')}
          className="h-7 px-2 text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
        >
          Batal
        </button>
        <button
          onClick={reject}
          className="h-7 px-3 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Ya, Tolak
        </button>
      </div>
    </div>
  )

  const isLoading = state === 'loading-confirm' || state === 'loading-reject'

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex items-center gap-1.5">
        <button
          onClick={confirm}
          disabled={isLoading}
          className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {state === 'loading-confirm'
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <CheckCircle className="w-3 h-3" />}
          Konfirmasi
        </button>
        <button
          onClick={() => setState('confirming-reject')}
          disabled={isLoading}
          className="flex items-center gap-1 h-7 px-2 text-xs text-red-500 border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
        >
          {state === 'loading-reject'
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <XCircle className="w-3 h-3" />}
          Tolak
        </button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-red-500 max-w-[180px] text-right">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
