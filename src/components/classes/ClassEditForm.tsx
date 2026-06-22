'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { classSchema, type ClassFormData } from '@/lib/validations/class'
import { CLASS_TYPES } from '@/lib/constants'
import { formatRupiah } from '@/lib/utils'
import { ClassPhotoUpload } from './ClassPhotoUpload'

interface Props {
  cls: {
    id: string
    name: string
    type: string
    day_of_week: number
    start_time: string
    end_time: string
    location: string | null
    google_maps_url?: string | null
    capacity: number | null
    description?: string | null
    class_price?: number | null
    revenue_share_pct?: number | null
    cover_image_url?: string | null
    show_registrations?: boolean | null
    payment_profile_id?: string | null
  }
  paymentProfiles?: { id: string; name: string }[]
  inModal?: boolean
  onClose?: () => void
  redirectTo?: string
}

const DAY_OPTIONS = [
  { value: 0, label: 'Minggu' },
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
]

const inputClass = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-gray-50 disabled:text-gray-400'

export function ClassEditForm({ cls, paymentProfiles = [], inModal = false, onClose, redirectTo = '/classes' }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name:              cls.name,
      type:              cls.type as ClassFormData['type'],
      day_of_week:       cls.day_of_week,
      start_time:        cls.start_time.substring(0, 5),
      end_time:          cls.end_time.substring(0, 5),
      location:          cls.location ?? '',
      google_maps_url:   cls.google_maps_url ?? '',
      payment_profile_id: cls.payment_profile_id ?? '',
      capacity:          cls.capacity ?? undefined,
      description:       cls.description ?? '',
      class_price:       cls.class_price ?? undefined,
      revenue_share_pct: cls.revenue_share_pct ?? 50,
      show_registrations: cls.show_registrations ?? false,
    },
  })

  const classPrice       = useWatch({ control, name: 'class_price' })
  const revenueSharePct  = useWatch({ control, name: 'revenue_share_pct' })

  const priceNum   = Number(classPrice)   || 0
  const shareNum   = Number(revenueSharePct) ?? 50
  const instrShare = Math.round(priceNum * shareNum / 100)
  const studioShare = priceNum - instrShare

  async function onSubmit(data: ClassFormData) {
    setServerError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('classes') as any)
      .update({
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
        show_registrations: data.show_registrations,
      })
      .eq('id', cls.id)

    if (error) { setServerError(error.message); return }

    if (inModal) {
      onClose?.()
      router.refresh()
    } else {
      router.push(redirectTo)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {serverError}
        </div>
      )}

      <ClassPhotoUpload classId={cls.id} currentUrl={cls.cover_image_url} />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nama Kelas</label>
        <input {...register('name')} className={inputClass} />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Tipe</label>
          <select {...register('type')} className={inputClass}>
            {CLASS_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Hari</label>
          <select {...register('day_of_week')} className={inputClass}>
            {DAY_OPTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Jam Mulai</label>
          <input
            {...register('start_time')}
            type="time"
            step="60"
            className={inputClass}
          />
          {errors.start_time && <p className="text-xs text-red-600">{errors.start_time.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Jam Selesai</label>
          <input
            {...register('end_time')}
            type="time"
            step="60"
            className={inputClass}
          />
          {errors.end_time && <p className="text-xs text-red-600">{errors.end_time.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Lokasi</label>
          <input {...register('location')} placeholder="Opsional" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Kapasitas</label>
          <input {...register('capacity')} type="number" min="1" placeholder="Tak terbatas" className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Link Google Maps
          <span className="text-gray-400 font-normal ml-1 text-xs">(opsional)</span>
        </label>
        <input {...register('google_maps_url')} placeholder="https://maps.app.goo.gl/..." className={inputClass} />
        {errors.google_maps_url && <p className="text-xs text-red-600">{errors.google_maps_url.message}</p>}
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
        {paymentProfiles.length === 0 && (
          <p className="text-xs text-gray-400">
            Belum ada Payment Profile yang siap (perlu minimal 1 metode pembayaran). Atur di menu Payment Profiles.
          </p>
        )}
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

      {/* Harga & Bagi Hasil */}
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

      {/* Tampilkan di landing page — paling bawah */}
      <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer">
        <input {...register('show_registrations')} type="checkbox" className="w-4 h-4 rounded accent-violet-600" />
        <span className="text-sm text-gray-700">
          Tampilkan peserta &amp; kuota di landing page
          <span className="block text-xs text-gray-400">Pengunjung bisa lihat siapa saja yang sudah daftar dan sisa kuota kelas ini</span>
        </span>
      </label>

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={() => inModal ? onClose?.() : router.back()}
          className="h-9 px-4 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  )
}
