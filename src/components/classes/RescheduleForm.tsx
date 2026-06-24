'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock, AlertCircle } from 'lucide-react'
import { generateRescheduleMessage } from '@/lib/class-notifications'
import { DAY_NAMES, formatTime } from '@/lib/utils'

interface Props {
  sessionId:    string
  className:    string
  location:     string
  dayOfWeek:    number
  sessionDate:  string
  startTime:    string
  endTime:      string
  backHref:     string
}

export function RescheduleForm({
  sessionId, className, location,
  dayOfWeek, sessionDate, startTime, endTime, backHref,
}: Props) {
  const router = useRouter()

  const [newDate,  setNewDate ] = useState(sessionDate)
  const [newStart, setNewStart] = useState(formatTime(startTime))
  const [newEnd,   setNewEnd  ] = useState(formatTime(endTime))
  const [reason,   setReason  ] = useState('')
  const [notifyWA, setNotifyWA] = useState(true)
  const [loading,  setLoading ] = useState(false)
  const [error,    setError   ] = useState('')

  const originalDay  = DAY_NAMES[dayOfWeek] ?? 'Hari biasa'
  const originalTime = formatTime(startTime)

  const preview = generateRescheduleMessage({
    className, originalDay, originalTime,
    newDate, newStartTime: newStart, newEndTime: newEnd,
    location: location || 'Lokasi biasa',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate || !newStart || !newEnd) { setError('Semua field wajib diisi'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reschedule`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ newDate, newStartTime: newStart, newEndTime: newEnd, reason, notify: notifyWA }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal reschedule')
      if (notifyWA && data.broadcastId) {
        router.push('/broadcasts')
      } else {
        router.push(backHref)
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <p className="text-xs text-gray-400">
        Perubahan hanya untuk sesi {sessionDate}, bukan jadwal rutin.
      </p>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
          Tanggal Baru
        </label>
        <input
          type="date"
          value={newDate}
          onChange={e => setNewDate(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Jam Mulai
          </label>
          <input
            type="time"
            value={newStart}
            onChange={e => setNewStart(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jam Selesai</label>
          <input
            type="time"
            value={newEnd}
            onChange={e => setNewEnd(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alasan (opsional)</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder="Contoh: studio tidak tersedia, instruktur ada acara..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

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

      {notifyWA && (
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
          onClick={() => router.push(backHref)}
          className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {loading ? 'Menyimpan...' : notifyWA ? 'Simpan & Buat Draft Notif' : 'Simpan Saja'}
        </button>
      </div>
    </form>
  )
}
