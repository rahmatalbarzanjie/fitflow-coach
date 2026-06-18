'use client'

import { useState } from 'react'
import { LogIn, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  profileId: string
  name: string
}

export function ImpersonateButton({ profileId, name }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function go() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/impersonate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profileId }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Gagal masuk sebagai instruktur')
      setLoading(false)
      return
    }
    window.location.href = '/'
  }

  if (confirming) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-xs text-amber-700 mb-2">
          Masuk sebagai <strong>{name}</strong>? Sesi developer Anda akan diganti - setelah selesai, logout lalu login lagi pakai akun developer.
        </p>
        {error && (
          <p className="flex items-center gap-1 text-xs text-red-600 mb-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="h-8 px-3 text-xs text-gray-500 border border-gray-200 hover:bg-white rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            onClick={go}
            disabled={loading}
            className="flex items-center gap-1.5 h-8 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            Ya, Masuk
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 h-8 px-3 border border-violet-200 text-violet-600 hover:bg-violet-50 rounded-lg text-xs font-medium transition-colors"
    >
      <LogIn className="w-3.5 h-3.5" />
      Masuk sebagai Instruktur Ini
    </button>
  )
}
