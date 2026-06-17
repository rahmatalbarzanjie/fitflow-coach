'use client'

import { useState } from 'react'
import { Users2, Loader2, Check, AlertCircle } from 'lucide-react'

interface Props {
  broadcastId: string
  groupName: string
}

type State = 'idle' | 'confirming' | 'sending' | 'done' | 'error'

export function BroadcastGroupSendButton({ broadcastId, groupName }: Props) {
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  async function send() {
    setState('sending')
    setError('')
    try {
      const res  = await fetch(`/api/broadcasts/${broadcastId}/send-group`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengirim')
        setState('error')
      } else {
        setState('done')
      }
    } catch {
      setError('Koneksi gagal')
      setState('error')
    }
  }

  if (state === 'done') return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <Check className="w-3.5 h-3.5" /> Terkirim ke grup
    </span>
  )

  if (state === 'confirming') return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs text-gray-600">Post ke grup &quot;{groupName}&quot;?</p>
      <div className="flex gap-1.5">
        <button
          onClick={() => setState('idle')}
          className="h-7 px-2 text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
        >
          Batal
        </button>
        <button
          onClick={send}
          className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
        >
          <Users2 className="w-3 h-3" /> Ya, Kirim
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setState('confirming')}
        disabled={state === 'sending'}
        className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg disabled:opacity-50 transition-colors"
      >
        {state === 'sending'
          ? <><Loader2 className="w-3 h-3 animate-spin" /> Mengirim...</>
          : <><Users2 className="w-3 h-3" /> Kirim ke Grup</>}
      </button>
      {state === 'error' && (
        <p className="flex items-center gap-1 text-[10px] text-red-500">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
