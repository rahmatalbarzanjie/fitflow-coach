'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Clock, MapPin, Users, AlertCircle, Sparkles } from 'lucide-react'
import { generateExtraClassMessage } from '@/lib/class-notifications'
import { formatTime } from '@/lib/utils'

interface ClassOption {
  id: string; name: string; type: string
  start_time: string; end_time: string; location: string | null
}

interface Props { classes: ClassOption[] }

const AUDIENCE_OPTIONS = [
  { value: 'all',    label: 'Semua member' },
  { value: 'active', label: 'Member aktif saja' },
]

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function ExtraClassForm({ classes }: Props) {
  const router = useRouter()

  const [selectedClassId, setSelectedClassId] = useState('')
  const [date,            setDate           ] = useState(tomorrow())
  const [startTime,       setStartTime      ] = useState('')
  const [endTime,         setEndTime        ] = useState('')
  const [location,        setLocation       ] = useState('')
  const [capacity,        setCapacity       ] = useState('')
  const [notes,           setNotes          ] = useState('')
  const [notifyWA,        setNotifyWA       ] = useState(true)
  const [audience,        setAudience       ] = useState('all')
  const [loading,         setLoading        ] = useState(false)
  const [error,           setError          ] = useState('')

  function handleClassChange(id: string) {
    setSelectedClassId(id)
    if (!id) return
    const cls = classes.find(c => c.id === id)
    if (!cls) return
    setStartTime(formatTime(cls.start_time))
    setEndTime(formatTime(cls.end_time))
    if (cls.location) setLocation(cls.location)
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)

  const preview = (selectedClass && startTime && endTime && location && date)
    ? generateExtraClassMessage({
        className: selectedClass.name,
        date,
        startTime,
        endTime,
        location,
        capacity: capacity ? Number(capacity) : null,
        notes,
      })
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClassId || !date || !startTime || !endTime || !location) {
      setError('Kelas, tanggal, jam, dan lokasi wajib diisi')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sessions/extra', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          classId: selectedClassId, sessionDate: date,
          startTime, endTime, location,
          capacity: capacity ? Number(capacity) : null,
          notes,
          notify: notifyWA, targetAudience: audience,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kelas ekstra')
      if (notifyWA && data.broadcastId) {
        router.push('/broadcasts')
      } else {
        router.push('/classes')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* 1. Jenis Kelas */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jenis Kelas</label>
        <select
          value={selectedClassId}
          onChange={e => handleClassChange(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        >
          <option value="">Pilih jenis kelas...</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 2. Tanggal */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
          Tanggal
        </label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      {/* 3. Jam */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Jam Mulai
          </label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jam Selesai</label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* 4. Lokasi */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          <MapPin className="w-3.5 h-3.5 inline mr-1" />
          Lokasi
        </label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          required
          placeholder="Nama studio / tempat kelas"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      {/* 5. Kapasitas */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          <Users className="w-3.5 h-3.5 inline mr-1" />
          Kapasitas (opsional)
        </label>
        <input
          type="number"
          min="1"
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
          placeholder="Kosongkan jika tidak terbatas"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      {/* 6. Catatan */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catatan untuk member (opsional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Info tambahan yang perlu member tahu..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Informasikan ke Member</p>

        {/* Toggle broadcast */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Broadcast WA ke member</p>
            <p className="text-xs text-gray-400">Simpan draft untuk dikirim</p>
          </div>
          <button
            type="button"
            onClick={() => setNotifyWA(v => !v)}
            className={`relative w-10 h-6 rounded-full transition-colors ${notifyWA ? 'bg-violet-600' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyWA ? 'left-5' : 'left-1'}`} />
          </button>
        </div>

        {/* Audience selector */}
        {notifyWA && (
          <div className="space-y-2 mb-4">
            {AUDIENCE_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={audience === opt.value}
                  onChange={() => setAudience(opt.value)}
                  className="accent-violet-600"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* Preview WA */}
        {notifyWA && preview && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-violet-500" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preview Pesan WA</p>
            </div>
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{preview}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <Link
          href="/classes"
          className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors text-center"
        >
          Batal
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {loading ? 'Menyimpan...' : 'Buat Kelas Ekstra'}
        </button>
      </div>
    </form>
  )
}
