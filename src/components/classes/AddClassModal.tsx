'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { classSchema, type ClassFormData } from '@/lib/validations/class'
import { CLASS_TYPES } from '@/lib/constants'
import { formatRupiah } from '@/lib/utils'
import { Plus, X, Upload, Loader2 } from 'lucide-react'

const DAY_OPTIONS = [
  { value: 0, label: 'Minggu' }, { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' }, { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
]

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function AddClassModal() {
  const router   = useRouter()
  const supabase = createClient()

  const [open,         setOpen        ] = useState(false)
  const [serverError,  setServerError ] = useState<string | null>(null)
  const [coverFile,    setCoverFile   ] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: { type: 'poundfit', day_of_week: new Date().getDay(), revenue_share_pct: 50 },
  })

  const classPrice      = useWatch({ control, name: 'class_price' })
  const revenueSharePct = useWatch({ control, name: 'revenue_share_pct' })
  const priceNum   = Number(classPrice) || 0
  const shareNum   = Number(revenueSharePct) ?? 50
  const instrShare = Math.round(priceNum * shareNum / 100)
  const studioShare = priceNum - instrShare

  function handleClose() {
    setOpen(false); reset(); setServerError(null)
    setCoverFile(null); setCoverPreview(null)
  }

  async function uploadCover(classId: string, file: File) {
    const ext  = file.name.split('.').pop()
    const path = `${classId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('class-covers').upload(path, file, { cacheControl: '3600', upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('class-covers').getPublicUrl(data.path)
      if (urlData?.publicUrl)
        await supabase.from('classes').update({ cover_image_url: urlData.publicUrl }).eq('id', classId)
    }
  }

  async function onSubmit(data: ClassFormData) {
    setServerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: cls, error } = await (supabase.from('classes') as any)
      .insert({
        user_id: user.id, name: data.name, type: data.type,
        day_of_week: data.day_of_week, start_time: data.start_time, end_time: data.end_time,
        location: data.location || null, capacity: data.capacity || null,
        description: data.description || null, class_price: data.class_price || null,
        revenue_share_pct: data.revenue_share_pct,
      })
      .select('id').single()

    if (error) { setServerError(error.message); return }
    if (coverFile) await uploadCover(cls.id, coverFile)

    await supabase.rpc('generate_sessions_for_class', { p_class_id: cls.id, p_days: 56 })
    handleClose()
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" /> Tambah Kelas
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg z-10 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900">Tambah Kelas</h2>
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="add-class-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {serverError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{serverError}</div>
                )}

                {/* Cover foto */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Foto Kelas <span className="text-gray-400 font-normal">(opsional, tampil di landing page)</span>
                  </label>
                  {coverPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 w-28 h-28">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreview} alt="preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 cursor-pointer w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 bg-gray-50 hover:bg-violet-50 transition-all">
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">Upload foto</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return
                        setCoverFile(f); setCoverPreview(URL.createObjectURL(f))
                      }} />
                    </label>
                  )}
                </div>

                {/* Nama */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nama Kelas <span className="text-red-500">*</span></label>
                  <input {...register('name')} autoFocus placeholder="Contoh: Poundfit Sore Energik" className={inp} />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
                </div>

                {/* Tipe + Hari */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipe <span className="text-red-500">*</span></label>
                    <select {...register('type')} className={inp}>
                      {CLASS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hari <span className="text-red-500">*</span></label>
                    <select {...register('day_of_week')} className={inp}>
                      {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Jam */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Jam Mulai <span className="text-red-500">*</span></label>
                    <input {...register('start_time')} type="time" step="60" className={inp} />
                    {errors.start_time && <p className="text-xs text-red-600 mt-1">{errors.start_time.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Jam Selesai <span className="text-red-500">*</span></label>
                    <input {...register('end_time')} type="time" step="60" className={inp} />
                    {errors.end_time && <p className="text-xs text-red-600 mt-1">{errors.end_time.message}</p>}
                  </div>
                </div>

                {/* Lokasi + Kapasitas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lokasi</label>
                    <input {...register('location')} placeholder="Studio A, GOR Lt.2" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Kapasitas</label>
                    <input {...register('capacity')} type="number" min="1" placeholder="Tak terbatas" className={inp} />
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Deskripsi <span className="text-gray-400 font-normal">(tampil di landing page)</span>
                  </label>
                  <textarea {...register('description')} rows={2} placeholder="Kelas cardio drumming energik! Cocok untuk semua level."
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
                          const el = document.querySelector('input[name="revenue_share_pct"]') as HTMLInputElement
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

                <p className="text-xs text-gray-400">Jadwal sesi dibuat otomatis untuk 8 minggu ke depan.</p>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
              <button type="button" onClick={handleClose}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button type="submit" form="add-class-form" disabled={isSubmitting}
                className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSubmitting ? 'Menyimpan...' : 'Simpan Kelas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
