'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquareWarning, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  sessionId: string
}

export function FeedbackRequestButton({ sessionId }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'confirming' | 'sending' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null)
  const [error,  setError]  = useState('')

  async function send() {
    setState('sending')
    setError('')
    try {
      const res = await fetch('/api/feedback/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Gagal mengirim'); setState('error'); return }
      setResult({ sent: data.sent, skipped: data.skipped })
      setState('done')
      router.refresh()
    } catch {
      setError('Koneksi gagal')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle className="w-3.5 h-3.5" />
        {result?.sent ?? 0} terkirim{(result?.skipped ?? 0) > 0 ? `, ${result?.skipped} sudah pernah diundang` : ''}
      </span>
    )
  }

  if (state === 'confirming') {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-xs text-gray-600">Kirim minta kritik & saran ke peserta yang hadir?</p>
        <div className="flex gap-1.5">
          <button onClick={() => setState('idle')} className="h-7 px-2 text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
            Batal
          </button>
          <button onClick={send} className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
            Ya, Kirim
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setState('confirming')}
        disabled={state === 'sending'}
        className="flex items-center gap-1.5 h-8 px-3 border border-violet-200 text-violet-600 hover:bg-violet-50 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
      >
        {state === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquareWarning className="w-3.5 h-3.5" />}
        Minta Kritik & Saran
      </button>
      {state === 'error' && (
        <p className="flex items-center gap-1 text-[10px] text-red-500">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
