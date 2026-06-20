'use client'

import { useState } from 'react'
import { Send, Loader2, Check, AlertCircle } from 'lucide-react'

interface Props {
  broadcastId: string
}

type State = 'idle' | 'confirming' | 'sending' | 'done' | 'error'

export function BroadcastSendButton({ broadcastId }: Props) {
  const [state,  setState ] = useState<State>('idle')
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null)
  const [error,  setError ] = useState('')

  async function send() {
    setState('sending')
    setError('')
    try {
      const res  = await fetch(`/api/broadcasts/${broadcastId}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengirim')
        setState('error')
      } else {
        setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0, skipped: data.skipped ?? 0 })
        setState('done')
      }
    } catch {
      setError('Koneksi gagal')
      setState('error')
    }
  }

  if (state === 'done') return (
    <span className="flex flex-col items-end text-xs text-green-600 font-medium">
      <span className="flex items-center gap-1">
        <Check className="w-3.5 h-3.5" />
        {result?.sent ?? 0} terkirim{(result?.failed ?? 0) > 0 ? `, ${result?.failed} gagal` : ''}
      </span>
      {(result?.skipped ?? 0) > 0 && (
        <span className="text-gray-400 font-normal">{result?.skipped} sudah terkirim sebelumnya, dilewati</span>
      )}
    </span>
  )

  if (state === 'confirming') return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs text-gray-600">Kirim ke semua member yang dipilih?</p>
      <div className="flex gap-1.5">
        <button
          onClick={() => setState('idle')}
          className="h-7 px-2 text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
        >
          Batal
        </button>
        <button
          onClick={send}
          className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Send className="w-3 h-3" /> Ya, Kirim
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setState('confirming')}
        disabled={state === 'sending'}
        className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        {state === 'sending'
          ? <><Loader2 className="w-3 h-3 animate-spin" /> Mengirim...</>
          : <><Send className="w-3 h-3" /> Kirim WA</>}
      </button>
      {state === 'error' && (
        <p className="flex items-center gap-1 text-[10px] text-red-500">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
