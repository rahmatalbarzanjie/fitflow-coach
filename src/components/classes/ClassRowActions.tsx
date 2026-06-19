'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { classSchema, type ClassFormData } from '@/lib/validations/class'
import { CLASS_TYPES } from '@/lib/constants'
import { formatRupiah, formatTime } from '@/lib/utils'
import { generateExtraClassMessage } from '@/lib/class-notifications'
import {
  MoreHorizontal, Pencil, Trash2, X,
  Loader2, CalendarDays, Clock, MapPin, Users, AlertCircle, Sparkles,
} from 'lucide-react'
import { WaGroupPicker } from '@/components/classes/WaGroupPicker'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cls {
  id: string; name: string; type: string
  day_of_week: number; start_time: string; end_time: string
  location: string | null; capacity: number | null
  description?: string | null; class_price?: number | null
  revenue_share_pct?: number | null; cover_image_url?: string | null
  show_registrations?: boolean | null
}

interface BenefitEntry { type: string; label: string; initialBenefits: string; userId: string }
interface AllClasses { id: string; name: string; type: string; start_time: string; end_time: string; location: string | null }

interface Props {
  cls: Cls
  allClasses: AllClasses[]
}

type Modal = 'edit' | 'delete' | null

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

const DAY_OPTIONS = [
  { value: 0, label: 'Minggu' }, { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' }, { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
]

function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full z-10 flex flex-col max-h-[90vh] ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ cls, onClose }: { cls: Cls; onClose: () => void }) {
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
      revenue_share_pct: data.revenue_share_pct,
      show_registrations: data.show_registrations,
    }).eq('id', cls.id)
    if (error) { setServerError(error.message); return }
    onClose(); router.refresh()
  }

  return (
    <>
      <form id="edit-class-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
        {serverError && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{serverError}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nama Kelas</label>
          <input {...register('name')} className={inp} />
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

        {/* Tampilkan di landing page */}
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
                  const el = document.querySelector(`#edit-class-form input[name="revenue_share_pct"]`) as HTMLInputElement
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
      </form>

      <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
        <button type="submit" form="edit-class-form" disabled={isSubmitting}
          className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </>
  )
}

// ─── Benefits Modal ───────────────────────────────────────────────────────────

function BenefitsModal({ benefits, onClose }: { benefits: BenefitEntry[]; onClose: () => void }) {
  const supabase = createClient()
  const [values,  setValues ] = useState<Record<string, string>>(
    Object.fromEntries(benefits.map(b => [b.type, b.initialBenefits]))
  )
  const [saving,  setSaving ] = useState<Record<string, boolean>>({})
  const [saved,   setSaved  ] = useState<Record<string, boolean>>({})

  async function save(type: string, userId: string) {
    setSaving(p => ({ ...p, [type]: true }))
    await supabase.from('class_type_benefits').upsert(
      { user_id: userId, type, benefits: values[type]?.trim() || null },
      { onConflict: 'user_id,type' }
    )
    setSaving(p => ({ ...p, [type]: false }))
    setSaved(p => ({ ...p, [type]: true }))
    setTimeout(() => setSaved(p => ({ ...p, [type]: false })), 2000)
  }

  return (
    <div className="px-6 py-5 space-y-4">
      {!benefits.length ? (
        <p className="text-sm text-gray-400 text-center py-8">Tambah kelas dulu untuk atur manfaatnya.</p>
      ) : benefits.map(b => (
        <div key={b.type}>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{b.label}</label>
          <textarea
            value={values[b.type] ?? ''}
            onChange={e => setValues(p => ({ ...p, [b.type]: e.target.value }))}
            rows={2}
            placeholder={`Contoh: ${b.label} bagus untuk membakar kalori dan meningkatkan stamina...`}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2"
          />
          <button onClick={() => save(b.type, b.userId)} disabled={saving[b.type]}
            className="flex items-center gap-1.5 h-8 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
            {saving[b.type] ? <Loader2 className="w-3 h-3 animate-spin" />
             : saved[b.type] ? <Check className="w-3 h-3" /> : null}
            {saved[b.type] ? 'Tersimpan' : 'Simpan'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Extra Class Modal ────────────────────────────────────────────────────────

function ExtraModal({ allClasses, onClose }: { allClasses: AllClasses[]; onClose: () => void }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState('')
  const [date,       setDate      ] = useState(tomorrow())
  const [startTime,  setStartTime ] = useState('')
  const [endTime,    setEndTime   ] = useState('')
  const [location,   setLocation  ] = useState('')
  const [capacity,   setCapacity  ] = useState('')
  const [notes,      setNotes     ] = useState('')
  const [notifyWA,   setNotifyWA  ] = useState(true)
  const [audience,   setAudience  ] = useState('all')
  const [loading,    setLoading   ] = useState(false)
  const [error,      setError     ] = useState('')

  function handleClassChange(id: string) {
    setSelectedId(id); if (!id) return
    const cls = allClasses.find(c => c.id === id); if (!cls) return
    setStartTime(formatTime(cls.start_time))
    setEndTime(formatTime(cls.end_time))
    if (cls.location) setLocation(cls.location)
  }

  const selectedClass = allClasses.find(c => c.id === selectedId)
  const preview = (selectedClass && startTime && endTime && location && date)
    ? generateExtraClassMessage({ className: selectedClass.name, date, startTime, endTime, location, capacity: capacity ? Number(capacity) : null, notes })
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !date || !startTime || !endTime || !location) {
      setError('Kelas, tanggal, jam, dan lokasi wajib diisi'); return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/sessions/extra', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedId, sessionDate: date, startTime, endTime, location, capacity: capacity ? Number(capacity) : null, notes, notify: notifyWA, targetAudience: audience }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kelas ekstra')
      onClose()
      router.push(notifyWA && data.broadcastId ? '/broadcasts' : '/classes')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  const inpE = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400'

  return (
    <>
      <form id="extra-class-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jenis Kelas</label>
          <select value={selectedId} onChange={e => handleClassChange(e.target.value)} required className={inpE}>
            <option value="">Pilih jenis kelas...</option>
            {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5"><CalendarDays className="w-3 h-3 inline mr-1" />Tanggal</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inpE} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5"><Clock className="w-3 h-3 inline mr-1" />Jam Mulai</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className={inpE} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jam Selesai</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className={inpE} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5"><MapPin className="w-3 h-3 inline mr-1" />Lokasi</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} required placeholder="Nama studio / tempat kelas" className={inpE} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5"><Users className="w-3 h-3 inline mr-1" />Kapasitas (opsional)</label>
          <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Kosongkan jika tidak terbatas" className={inpE} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catatan (opsional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Info tambahan untuk member..." className={`${inpE} resize-none`} />
        </div>
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Broadcast WA ke member</p>
              <p className="text-xs text-gray-400">Simpan draft untuk dikirim</p>
            </div>
            <button type="button" onClick={() => setNotifyWA(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${notifyWA ? 'bg-violet-600' : 'bg-gray-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyWA ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
          {notifyWA && (
            <div className="space-y-2 mb-3">
              {[{ value: 'all', label: 'Semua member' }, { value: 'active', label: 'Member aktif saja' }].map(opt => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="radio" name="extra-audience" value={opt.value} checked={audience === opt.value} onChange={() => setAudience(opt.value)} className="accent-violet-600" />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
          {notifyWA && preview && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-violet-500" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preview Pesan WA</p>
              </div>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{preview}</p>
            </div>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 shrink-0" /><p className="text-xs">{error}</p>
          </div>
        )}
      </form>
      <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
        <button type="submit" form="extra-class-form" disabled={loading}
          className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Menyimpan...' : 'Buat Kelas Ekstra'}
        </button>
      </div>
    </>
  )
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ cls, onClose }: { cls: Cls; onClose: () => void }) {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await (supabase.from('classes') as any).delete().eq('id', cls.id)
    onClose(); router.push('/classes'); router.refresh()
  }

  return (
    <div className="px-6 py-5">
      <p className="text-sm text-gray-600 mb-1">Kamu yakin ingin menghapus kelas ini?</p>
      <p className="text-sm font-semibold text-gray-900 mb-3">"{cls.name}"</p>
      <p className="text-xs text-red-500 mb-5">Semua sesi dan riwayat absensi kelas ini juga akan terhapus.</p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
        <button onClick={handleDelete} disabled={loading}
          className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Menghapus...' : 'Ya, Hapus'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClassRowActions({ cls, allClasses }: Props) {
  const [open,  setOpen ] = useState(false)
  const [modal, setModal] = useState<Modal>(null)

  function openModal(m: Modal) { setOpen(false); setModal(m) }
  function closeModal() { setModal(null) }

  return (
    <>
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
              <button onClick={() => openModal('edit')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit Kelas
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => openModal('delete')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Hapus Kelas
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {modal === 'edit' && (
        <Modal title={`Edit — ${cls.name}`} onClose={closeModal} wide>
          <EditModal cls={cls} onClose={closeModal} />
        </Modal>
      )}
      {modal === 'delete' && (
        <Modal title="Hapus Kelas" onClose={closeModal}>
          <DeleteModal cls={cls} onClose={closeModal} />
        </Modal>
      )}
    </>
  )
}
