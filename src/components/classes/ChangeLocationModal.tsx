'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, MapPin, AlertCircle } from 'lucide-react'
import { generateLocationChangeMessage } from '@/lib/class-notifications'
import { DAY_NAMES, formatTime } from '@/lib/utils'

interface Props {
  sessionId:   string
  className:   string
  dayOfWeek:   number
  startTime:   string
  endTime:     string
  oldLocation: string
  onClose:     () => void
}

export function ChangeLocationModal({
  sessionId, className, dayOfWeek, startTime, endTime, oldLocation, onClose,
}: Props) {
  const router = useRouter()

  const [newLocation, setNewLocation] = useState('')
  const [notes,       setNotes      ] = useState('')
  const [notifyWA,    setNotifyWA   ] = useState(true)
  const [loading,     setLoading    ] = useState(false)
  const [error,       setError      ] = useState('')

  const dayName = DAY_NAMES[dayOfWeek] ?? 'Hari ini'

  const preview = newLocation.trim()
    ? generateLocationChangeMessage({
        className,
        dayName,
        startTime,
        endTime,
        oldLocation: oldLocation || 'lokasi biasa',
        newLocation: newLocation.trim(),
      })
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newLocation.trim()) { setError('Lokasi baru wajib diisi'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/location`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ newLocation: newLocation.trim(), notes, notify: notifyWA }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal update lokasi')
      onClose()
      if (notifyWA && data.broadcastId) {
        router.push('/broadcasts')
      } else {
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Ubah Lokasi Sesi Ini</h2>
            <p className="text-xs text-gray-400 mt-0.5">Hanya berlaku untuk sesi ini saja.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Lokasi sekarang */}
          {oldLocation && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400">Lokasi saat ini</p>
              <p className="text-sm font-medium text-gray-700 mt-0.5">{oldLocation}</p>
            </div>
          )}

          {/* Lokasi Baru */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              Lokasi Baru
            </label>
            <input
              type="text"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
              required
              placeholder="Contoh: Casadova Gym Center, Lt. 2"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catatan tambahan (opsional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Info tambahan yang perlu member tahu..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>

          {/* Toggle WA */}
          <div className="flex items-center justify-between py-3 border-t border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-800">Informasikan ke member via WA</p>
              <p className="text-xs text-gray-400">Simpan draft broadcast untuk dikirim</p>
            </div>
            <button
              type="button"
              onClick={() => setNotifyWA(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${notifyWA ? 'bg-violet-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyWA ? 'left-5' : 'left-1'}`} />
            </button>
          </div>

          {/* Preview */}
          {notifyWA && preview && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Preview Pesan WA</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{preview}</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {loading ? 'Menyimpan...' : notifyWA ? 'Simpan & Kirim Notif' : 'Simpan Saja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
