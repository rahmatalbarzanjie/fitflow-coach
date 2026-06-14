'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { classSchema, type ClassFormData } from '@/lib/validations/class'
import { CLASS_TYPES } from '@/lib/constants'

interface Props {
  cls: {
    id: string
    name: string
    type: string
    day_of_week: number
    start_time: string
    end_time: string
    location: string | null
    capacity: number | null
    description?: string | null
    payment_mode?: string | null
    class_price?: number | null
  }
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

export function ClassEditForm({ cls }: Props) {
  const [saved, setSaved]         = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const supabase = createClient()

  const { register, handleSubmit, control, formState: { errors, isDirty, isSubmitting } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name:         cls.name,
      type:         cls.type as ClassFormData['type'],
      day_of_week:  cls.day_of_week,
      start_time:   cls.start_time.substring(0, 5),
      end_time:     cls.end_time.substring(0, 5),
      location:     cls.location ?? '',
      capacity:     cls.capacity ?? undefined,
      description:  cls.description ?? '',
      payment_mode: (cls.payment_mode as ClassFormData['payment_mode']) ?? 'free',
      class_price:  cls.class_price ?? undefined,
    },
  })
  const paymentMode = useWatch({ control, name: 'payment_mode' })

  async function onSubmit(data: ClassFormData) {
    setServerError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('classes') as any)
      .update({
        name:         data.name,
        type:         data.type,
        day_of_week:  data.day_of_week,
        start_time:   data.start_time,
        end_time:     data.end_time,
        location:     data.location || null,
        capacity:     data.capacity || null,
        description:  data.description || null,
        payment_mode: data.payment_mode,
        class_price:  data.payment_mode === 'free' ? null : (data.class_price || null),
      })
      .eq('id', cls.id)

    if (error) { setServerError(error.message); return }

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {serverError}
        </div>
      )}

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
          <input {...register('start_time')} type="time" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Jam Selesai</label>
          <input {...register('end_time')} type="time" className={inputClass} />
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
          Deskripsi Kelas
          <span className="text-gray-400 font-normal ml-1 text-xs">(tampil di landing page)</span>
        </label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Contoh: Kelas cardio drumming energik! Bawa ripstix. Cocok untuk semua level."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Payment Mode */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Biaya Kelas</label>
        <div className="flex gap-2">
          {(['free', 'cash', 'transfer'] as const).map(mode => {
            const labels = { free: 'Gratis', cash: 'Bayar Tunai', transfer: 'Bayar Transfer' }
            return (
              <label
                key={mode}
                className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors text-sm ${
                  paymentMode === mode
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <input {...register('payment_mode')} type="radio" value={mode} className="hidden" />
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${paymentMode === mode ? 'border-violet-500' : 'border-gray-300'}`}>
                  {paymentMode === mode && <div className="w-2 h-2 bg-violet-500 rounded-full" />}
                </div>
                {labels[mode]}
              </label>
            )
          })}
        </div>
        {paymentMode !== 'free' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">Nominal (Rp)</label>
            <input
              {...register('class_price')}
              type="number"
              min="0"
              placeholder="Contoh: 50000"
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {serverError && <p className="text-xs text-red-600 flex-1">{serverError}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : saved ? 'Tersimpan ✓' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  )
}
