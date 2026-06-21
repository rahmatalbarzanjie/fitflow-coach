'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Unplug } from 'lucide-react'

export function WhatsAppDisconnectButton() {
  const router   = useRouter()
  const [confirm,    setConfirm   ] = useState(false)
  const [loading,    setLoading   ] = useState(false)
  const [error,      setError     ] = useState('')

  async function handleDisconnect() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wa/disconnect', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Gagal memutuskan koneksi')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memutuskan koneksi')
    } finally {
      setLoading(false)
    }
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="flex items-center gap-2 h-10 px-4 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
      >
        <Unplug className="w-4 h-4" /> Putuskan Koneksi
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-red-600 font-medium">
        Yakin ingin memutuskan koneksi WhatsApp? Broadcast dan notifikasi otomatis akan berhenti.
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setConfirm(false)}
          className="flex-1 h-10 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium">
          Batal
        </button>
        <button onClick={handleDisconnect} disabled={loading}
          className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Memutuskan...' : 'Ya, Putuskan'}
        </button>
      </div>
    </div>
  )
}
