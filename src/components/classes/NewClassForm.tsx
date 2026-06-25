'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { classSchema, type ClassFormData } from '@/lib/validations/class'
import { CLASS_TYPES } from '@/lib/constants'
import { formatRupiah } from '@/lib/utils'

const DAY_OPTIONS = [
  { value: 0, label: 'Minggu' },
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
]

const inputClass = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

interface Props {
  paymentProfiles?: { id: string; name: string }[]
}

export function NewClassForm({ paymentProfiles = [] }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [coverFile, setCoverFile]     = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      type:              'zumba',
      day_of_week:       new Date().getDay(),
      revenue_share_pct: 50,
    },
  })

  const classPrice      = useWatch({ control, name: 'class_price' })
  const revenueSharePct = useWatch({ control, name: 'revenue_share_pct' })

  const priceNum    = Number(classPrice) || 0
  const shareNum    = Number(revenueSharePct) ?? 50
  const instrShare  = Math.round(priceNum * shareNum / 100)
  const studioShare = priceNum - instrShare

  async function uploadCover(classId: string, file: File) {
    const ext  = file.name.split('.').pop()
    const path = `${classId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('class-covers')
      .upload(path, file, { cacheControl: '3600', upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('class-covers').getPublicUrl(data.path)
      const url = urlData?.publicUrl ?? null
      if (url) await supabase.from('classes').update({ cover_image_url: url }).eq('id', classId)
    }
  }

  async function onSubmit(data: ClassFormData) {
    setServerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cls, error } = await (supabase.from('classes') as any)
      .insert({
        user_id:           user.id,
        name:              data.name,
        type:              data.type,
        day_of_week:       data.day_of_week,
        start_time:        data.start_time,
        end_time:          data.end_time,
        location:          data.location || null,
        google_maps_url:   data.google_maps_url || null,
        payment_profile_id: data.payment_profile_id || null,
        capacity:          data.capacity || null,
        description:       data.description || null,
        class_price:       data.class_price || null,
        revenue_share_pct: data.revenue_share_pct,
      })
      .select('id')
      .single()

    if (error) { setServerError(error.message); return }

    if (coverFile) await uploadCover(cls.id, coverFile)

    // Auto-generate sessions for the next 56 days (8 weeks)
    await supabase.rpc('generate_sessions_for_class', {
      p_class_id: cls.id,
      p_days_ahead: 56,
    })

    router.push('/classes')
    router.refresh()
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/classes" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Tambah Kelas</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Foto Kelas
              <span className="text-gray-400 font-normal ml-1 text-xs">(tampil di landing page, opsional)</span>
            </label>
            {coverPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 group w-32 h-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverPreview} alt="preview foto kelas" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer w-32 h-32 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 bg-gray-50 hover:bg-violet-50 transition-all">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 text-center px-1">Upload foto</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setCoverFile(f)
                    setCoverPreview(URL.createObjectURL(f))
                  }}
                />
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nama Kelas <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              autoFocus
              placeholder="Contoh: Zumba Pagi Semangat"
              className={inputClass}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Tipe <span className="text-red-500">*</span>
              </label>
              <select {...register('type')} className={inputClass}>
                {CLASS_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Hari <span className="text-red-500">*</span>
              </label>
              <select {...register('day_of_week')} className={inputClass}>
                {DAY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Jam Mulai <span className="text-red-500">*</span>
              </label>
              <input {...register('start_time')} type="time" step="60" className={inputClass} />
              {errors.start_time && <p className="text-xs text-red-600">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Jam Selesai <span className="text-red-500">*</span>
              </label>
              <input {...register('end_time')} type="time" step="60" className={inputClass} />
              {errors.end_time && <p className="text-xs text-red-600">{errors.end_time.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Lokasi</label>
              <input
                {...register('location')}
                placeholder="Contoh: Studio A, GOR Lt.2"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Link Google Maps
                <span className="text-gray-400 font-normal ml-1 text-xs">(opsional)</span>
              </label>
              <input {...register('google_maps_url')} placeholder="https://maps.app.goo.gl/..." className={inputClass} />
              {errors.google_maps_url && <p className="text-xs text-red-600">{errors.google_maps_url.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Payment Profile
              <span className="text-gray-400 font-normal ml-1 text-xs">(tujuan pembayaran)</span>
            </label>
            <select {...register('payment_profile_id')} className={inputClass}>
              <option value="">Belum diatur</option>
              {paymentProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Kapasitas</label>
            <input
              {...register('capacity')}
              type="number"
              min="1"
              placeholder="Tak terbatas"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Deskripsi
              <span className="text-gray-400 font-normal ml-1 text-xs">(tampil di landing page)</span>
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Contoh: Kelas cardio drumming energik! Cocok untuk semua level."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Keuangan */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Keuangan</p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Harga per Sesi (Rp)</label>
              <input
                {...register('class_price')}
                type="number"
                min="0"
                placeholder="Contoh: 75000"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-600">Bagi Hasil - Instruktur</label>
                <span className="text-xs text-gray-400">Studio mendapat {100 - shareNum}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  {...register('revenue_share_pct')}
                  type="number"
                  min="0"
                  max="100"
                  className="w-20 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white text-center"
                />
                <span className="text-sm text-gray-500">%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={shareNum}
                  onChange={e => {
                    const el = document.querySelector('input[name="revenue_share_pct"]') as HTMLInputElement
                    if (el) { el.value = e.target.value; el.dispatchEvent(new Event('input', { bubbles: true })) }
                  }}
                  className="flex-1 accent-violet-600"
                />
              </div>
            </div>

            {priceNum > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-2.5 text-center">
                  <p className="text-xs text-violet-500 font-medium">Instruktur</p>
                  <p className="text-sm font-bold text-violet-700 mt-0.5">{formatRupiah(instrShare)}</p>
                </div>
                <div className="rounded-lg bg-gray-100 border border-gray-200 p-2.5 text-center">
                  <p className="text-xs text-gray-500 font-medium">Studio</p>
                  <p className="text-sm font-bold text-gray-700 mt-0.5">{formatRupiah(studioShare)}</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">Jadwal sesi awal dibuat untuk 8 minggu ke depan. Setelah itu, tambah sesi lagi dari halaman detail kelas.</p>

          <div className="flex gap-3 pt-1">
            <Link
              href="/classes"
              className="flex-1 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Kelas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
