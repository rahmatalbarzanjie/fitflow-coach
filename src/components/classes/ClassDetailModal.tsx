'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { classSchema, type ClassFormData } from '@/lib/validations/class'
import { CLASS_TYPES } from '@/lib/constants'
import { formatRupiah, formatTime, formatDateShort, DAY_NAMES } from '@/lib/utils'
import { generateRescheduleMessage, generateLocationChangeMessage } from '@/lib/class-notifications'
import { WaGroupPicker } from '@/components/classes/WaGroupPicker'
import {
  X, Clock, CheckSquare, Loader2, RefreshCw, MapPin,
  CalendarDays, AlertCircle, Users,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cls {
  id: string; name: string; type: string
  day_of_week: number; start_time: string; end_time: string
  location: string | null; capacity: number | null
  description?: string | null; class_price?: number | null
  revenue_share_pct?: number | null; cover_image_url?: string | null
  show_registrations?: boolean | null
  wa_group_id?: string | null; wa_group_name?: string | null
}

interface Session {
  id: string; session_date: string; session_type: string
  start_time: string; end_time: string; notified_at: string | null
  attendance: { id: string }[]
}

type Tab = 'info' | 'jadwal' | 'riwayat'

const DAY_OPTIONS = [
  { value: 0, label: 'Minggu' }, { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' }, { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
]

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

function upcomingDates(dayOfWeek: number, count = 5): string[] {
  const dates: string[] = []
  const d = new Date()
  while (dates.length < count) {
    if (d.getDay() === dayOfWeek) dates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return dates
}

// ─── Tab: Info (Edit) ─────────────────────────────────────────────────────────

function TabInfo({ cls, onClose }: { cls: Cls; onClose: () => void }) {
  const router   = useRouter()
  const supabase = createClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: cls.name, type: cls.type as ClassFormData['type'],
      day_of_week: cls.day_of_week,
      start_time: cls.start_time.substring(0, 5),
      end_time: cls.end_time.substring(0, 5),
      location: cls.location ?? '', capacity: cls.capacity ?? undefined,
      description: cls.description ?? '', class_price: cls.class_price ?? undefined,
      revenue_share_pct: cls.revenue_share_pct ?? 50,
      show_registrations: cls.show_registrations ?? false,
    },
  })

  const classPrice      = useWatch({ control, name: 'class_price' })
  const revenueSharePct = useWatch({ control, name: 'revenue_share_pct' })
  const priceNum    = Number(classPrice) || 0
  const shareNum    = Number(revenueSharePct) ?? 50
  const instrShare  = Math.round(priceNum * shareNum / 100)
  const studioShare = priceNum - instrShare

  async function onSubmit(data: ClassFormData) {
    setServerError(null)
    const { error } = await (supabase.from('classes') as any).update({
      name: data.name, type: data.type, day_of_week: data.day_of_week,
      start_time: data.start_time, end_time: data.end_time,
      location: data.location || null, capacity: data.capacity || null,
      description: data.description || null, class_price: data.class_price || null,
      revenue_share_pct: data.revenue_share_pct, show_registrations: data.show_registrations,
    }).eq('id', cls.id)
    if (error) { setServerError(error.message); return }
    onClose(); router.refresh()
  }

  return (
    <>
      <form id="class-detail-info-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
        {serverError && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{serverError}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nama Kelas</label>
          <input {...register('name')} className={inp} autoFocus />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
            <select {...register('type')} className={inp}>
              {CLASS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hari</label>
            <select {...register('day_of_week')} className={inp}>
              {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jam Mulai</label>
            <input {...register('start_time')} type="time" step="60" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jam Selesai</label>
            <input {...register('end_time')} type="time" step="60" className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lokasi</label>
            <input {...register('location')} placeholder="Opsional" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kapasitas</label>
            <input {...register('capacity')} type="number" min="1" placeholder="Tak terbatas" className={inp} />
          </div>
        </div>

        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer">
          <input {...register('show_registrations')} type="checkbox" className="w-4 h-4 mt-0.5 rounded accent-violet-600" />
          <span className="text-xs text-gray-700">
            <span className="font-medium">Tampilkan peserta & kuota di landing page</span>
            <span className="block text-gray-400 mt-0.5">Pengunjung bisa lihat siapa yang sudah daftar dan sisa kuota</span>
          </span>
        </label>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Deskripsi <span className="text-gray-400 font-normal">(tampil di landing page)</span>
          </label>
          <textarea {...register('description')} rows={2}
            placeholder="Kelas cardio drumming energik! Cocok untuk semua level."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {/* Keuangan */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Keuangan</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Harga per Sesi (Rp)</label>
            <input {...register('class_price')} type="number" min="0" placeholder="Contoh: 75000" className={inp} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Bagi Hasil — Instruktur</label>
              <span className="text-xs text-gray-400">Studio {100 - shareNum}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input {...register('revenue_share_pct')} type="number" min="0" max="100"
                className="w-16 h-9 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-center bg-white" />
              <span className="text-sm text-gray-400">%</span>
              <input type="range" min="0" max="100" value={shareNum} className="flex-1 accent-violet-600"
                onChange={e => {
                  const el = document.querySelector('#class-detail-info-form input[name="revenue_share_pct"]') as HTMLInputElement
                  if (el) { el.value = e.target.value; el.dispatchEvent(new Event('input', { bubbles: true })) }
                }} />
            </div>
            {priceNum > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-2 text-center">
                  <p className="text-[10px] text-violet-500 font-medium">Instruktur</p>
                  <p className="text-sm font-bold text-violet-700">{formatRupiah(instrShare)}</p>
                </div>
                <div className="rounded-lg bg-gray-100 border border-gray-200 p-2 text-center">
                  <p className="text-[10px] text-gray-500 font-medium">Studio</p>
                  <p className="text-sm font-bold text-gray-700">{formatRupiah(studioShare)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grup WA */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Grup WA Kelas (Level 2)</p>
          <WaGroupPicker
            classId={cls.id}
            currentGroupId={cls.wa_group_id ?? null}
            currentGroupName={cls.wa_group_name ?? null}
          />
        </div>
      </form>

      <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
        <button type="submit" form="class-detail-info-form" disabled={isSubmitting}
          className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </>
  )
}

// ─── Tab: Jadwal (Reschedule & Ubah Lokasi) ──────────────────────────────────

function TabJadwal({ cls }: { cls: Cls }) {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]
  const dates  = upcomingDates(cls.day_of_week, 5)

  type SubModal = { type: 'reschedule' | 'location'; session: any; date: string } | null
  const [loading,    setLoading  ] = useState<string | null>(null)
  const [subModal,   setSubModal ] = useState<SubModal>(null)
  const [error,      setError    ] = useState('')

  async function openSub(date: string, type: 'reschedule' | 'location') {
    setLoading(date); setError('')
    try {
      const res  = await fetch('/api/sessions/ensure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cls.id, sessionDate: date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubModal({ type, session: data.session, date })
    } catch (e: any) { setError(e.message) }
    finally { setLoading(null) }
  }

  // Reschedule form state
  const [newDate,   setNewDate  ] = useState('')
  const [newStart,  setNewStart ] = useState('')
  const [newEnd,    setNewEnd   ] = useState('')
  const [reason,    setReason   ] = useState('')
  const [newLoc,    setNewLoc   ] = useState('')
  const [notes,     setNotes    ] = useState('')
  const [notifyWA,  setNotifyWA ] = useState(true)
  const [submitting,setSubmitting] = useState(false)
  const [subError,  setSubError ] = useState('')

  useEffect(() => {
    if (subModal) {
      setNewDate(subModal.date)
      setNewStart(formatTime(subModal.session.start_time))
      setNewEnd(formatTime(subModal.session.end_time))
      setNewLoc(''); setNotes(''); setReason(''); setSubError('')
    }
  }, [subModal])

  async function submitReschedule(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate || !newStart || !newEnd) { setSubError('Semua field wajib diisi'); return }
    setSubmitting(true); setSubError('')
    try {
      const res = await fetch(`/api/sessions/${subModal!.session.id}/reschedule`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDate, newStartTime: newStart, newEndTime: newEnd, reason, notify: notifyWA }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubModal(null)
      notifyWA && data.broadcastId ? router.push('/broadcasts') : router.refresh()
    } catch (e: any) { setSubError(e.message) }
    finally { setSubmitting(false) }
  }

  async function submitLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!newLoc.trim()) { setSubError('Lokasi baru wajib diisi'); return }
    setSubmitting(true); setSubError('')
    try {
      const res = await fetch(`/api/sessions/${subModal!.session.id}/location`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLocation: newLoc.trim(), notes, notify: notifyWA }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubModal(null)
      notifyWA && data.broadcastId ? router.push('/broadcasts') : router.refresh()
    } catch (e: any) { setSubError(e.message) }
    finally { setSubmitting(false) }
  }

  const inpS = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400'

  const reschedulePreview = subModal?.type === 'reschedule' && newDate && newStart && newEnd
    ? generateRescheduleMessage({
        className: cls.name,
        originalDay: DAY_NAMES[cls.day_of_week] ?? '',
        originalTime: formatTime(cls.start_time),
        newDate, newStartTime: newStart, newEndTime: newEnd,
        location: cls.location || 'Lokasi biasa',
      })
    : ''

  const locationPreview = subModal?.type === 'location' && newLoc.trim()
    ? generateLocationChangeMessage({
        className: cls.name,
        dayName: DAY_NAMES[cls.day_of_week] ?? '',
        startTime: formatTime(cls.start_time),
        endTime: formatTime(cls.end_time),
        oldLocation: cls.location || 'lokasi biasa',
        newLocation: newLoc.trim(),
      })
    : ''

  return (
    <div className="px-6 py-5">
      <p className="text-xs text-gray-400 mb-4">Pilih tanggal untuk reschedule atau ubah lokasi satu sesi.</p>
      <div className="space-y-2">
        {dates.map(date => {
          const isToday   = date === today
          const isLoading = loading === date
          return (
            <div key={date} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isToday ? 'border-violet-200 bg-violet-50/40' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-center gap-2">
                {isLoading && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
                <span className="text-sm font-medium text-gray-800">{formatDateShort(date)}</span>
                {isToday && <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-bold">Hari Ini</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openSub(date, 'reschedule')} disabled={!!loading}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border border-orange-200 text-orange-600 hover:bg-orange-50 disabled:opacity-40">
                  <RefreshCw className="w-3 h-3" /> Reschedule
                </button>
                <button onClick={() => openSub(date, 'location')} disabled={!!loading}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40">
                  <MapPin className="w-3 h-3" /> Ubah Lokasi
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {/* Sub-modal: Reschedule */}
      {subModal?.type === 'reschedule' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSubModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Reschedule Sesi</h3>
                <p className="text-xs text-gray-400 mt-0.5">Hanya untuk sesi {subModal.date}</p>
              </div>
              <button onClick={() => setSubModal(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitReschedule} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1"><CalendarDays className="w-3 h-3 inline mr-1" />Tanggal Baru</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className={inpS} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Jam Mulai</label>
                  <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} required className={inpS} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Jam Selesai</label>
                  <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} required className={inpS} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alasan (opsional)</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Contoh: studio tidak tersedia..." className={`${inpS} resize-none`} />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Informasikan ke member via WA</p>
                  <p className="text-xs text-gray-400">Simpan draft broadcast</p>
                </div>
                <button type="button" onClick={() => setNotifyWA(v => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${notifyWA ? 'bg-violet-600' : 'bg-gray-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyWA ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
              {notifyWA && reschedulePreview && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Preview WA</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{reschedulePreview}</p>
                </div>
              )}
              {subError && <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3"><AlertCircle className="w-4 h-4" /><p className="text-xs">{subError}</p></div>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setSubModal(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={submitting} className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? 'Menyimpan...' : notifyWA ? 'Simpan & Notif' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-modal: Ubah Lokasi */}
      {subModal?.type === 'location' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSubModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Ubah Lokasi Sesi</h3>
                <p className="text-xs text-gray-400 mt-0.5">Hanya berlaku untuk sesi ini saja</p>
              </div>
              <button onClick={() => setSubModal(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitLocation} className="p-5 space-y-3">
              {cls.location && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400">Lokasi saat ini</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">{cls.location}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1"><MapPin className="w-3 h-3 inline mr-1" />Lokasi Baru</label>
                <input type="text" value={newLoc} onChange={e => setNewLoc(e.target.value)} required placeholder="Contoh: Casadova Gym Center, Lt. 2" className={inpS} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan (opsional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Info tambahan untuk member..." className={`${inpS} resize-none`} />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Informasikan ke member via WA</p>
                  <p className="text-xs text-gray-400">Simpan draft broadcast</p>
                </div>
                <button type="button" onClick={() => setNotifyWA(v => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${notifyWA ? 'bg-violet-600' : 'bg-gray-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyWA ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
              {notifyWA && locationPreview && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Preview WA</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{locationPreview}</p>
                </div>
              )}
              {subError && <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3"><AlertCircle className="w-4 h-4" /><p className="text-xs">{subError}</p></div>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setSubModal(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={submitting} className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? 'Menyimpan...' : notifyWA ? 'Simpan & Notif' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Riwayat Sesi ────────────────────────────────────────────────────────

function TabRiwayat({ cls }: { cls: Cls }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading ] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await (supabase.from('sessions') as any)
      .select('id, session_date, session_type, start_time, end_time, notified_at, attendance(id)')
      .eq('class_id', cls.id)
      .order('session_date', { ascending: false })
      .limit(20)
    setSessions(data ?? [])
    setLoading(false)
  }, [cls.id])

  useEffect(() => { load() }, [load])

  const SESSION_BADGE: Record<string, { label: string; color: string }> = {
    rescheduled:      { label: 'Dijadwal Ulang', color: 'bg-orange-50 text-orange-700' },
    extra:            { label: 'Ekstra',          color: 'bg-green-50 text-green-700'  },
    location_changed: { label: 'Lokasi Baru',     color: 'bg-blue-50 text-blue-700'    },
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
    </div>
  )

  if (!sessions.length) return (
    <div className="text-center py-16 px-6">
      <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Belum ada riwayat sesi</p>
      <p className="text-xs text-gray-300 mt-1">Sesi akan muncul setelah absensi pertama</p>
    </div>
  )

  return (
    <div className="px-6 py-5">
      <div className="divide-y divide-gray-50">
        {sessions.map(s => {
          const count    = Array.isArray(s.attendance) ? s.attendance.length : 0
          const isToday  = s.session_date === today
          const isPast   = s.session_date < today
          const sessBadge = s.session_type && s.session_type !== 'regular' ? SESSION_BADGE[s.session_type] : null

          return (
            <div key={s.id} className={`flex items-center justify-between py-3 ${isToday ? 'bg-violet-50/50 -mx-6 px-6' : ''}`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-800">{formatDateShort(s.session_date)}</p>
                  {isToday && <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Hari Ini</span>}
                  {sessBadge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sessBadge.color}`}>{sessBadge.label}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  {count > 0 && <span className="ml-2 font-medium text-gray-600">{count} hadir</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={`/classes/${cls.id}/attendance?date=${s.session_date}`}
                  className={`flex items-center gap-1 h-7 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isToday || !isPast ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}>
                  <CheckSquare className="w-3 h-3" />
                  {count > 0 ? 'Lihat' : 'Absen'}
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main: ClassDetailModal ───────────────────────────────────────────────────

interface MainProps {
  cls: Cls
  onClose: () => void
}

export function ClassDetailModal({ cls, onClose }: MainProps) {
  const [tab, setTab] = useState<Tab>('info')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info',    label: 'Info & Edit'  },
    { key: 'jadwal',  label: 'Jadwal'       },
    { key: 'riwayat', label: 'Riwayat Sesi' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg z-10 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 truncate">{cls.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {DAY_OPTIONS.find(d => d.value === cls.day_of_week)?.label} · {formatTime(cls.start_time)}–{formatTime(cls.end_time)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 ml-3 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-gray-100 shrink-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-violet-600 text-violet-600 bg-violet-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1">
          {tab === 'info'    && <TabInfo    cls={cls} onClose={onClose} />}
          {tab === 'jadwal'  && <TabJadwal  cls={cls} />}
          {tab === 'riwayat' && <TabRiwayat cls={cls} />}
        </div>
      </div>
    </div>
  )
}
