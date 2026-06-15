'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { classSchema, type ClassFormData } from '@/lib/validations/class'
import { CLASS_TYPES } from '@/lib/constants'

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

export default function NewClassPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      type:         'zumba',
      day_of_week:  new Date().getDay(),
      payment_mode: 'free',
    },
  })
  const paymentMode = useWatch({ control, name: 'payment_mode' })

  async function onSubmit(data: ClassFormData) {
    setServerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cls, error } = await (supabase.from('classes') as any)
      .insert({
        user_id:      user.id,
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
      .select('id')
      .single()

    if (error) { setServerError(error.message); return }

    // Auto-generate sessions for the next 56 days (8 weeks)
    await supabase.rpc('generate_sessions_for_class', {
      p_class_id: cls.id,
      p_days: 56,
    })

    router.push('/classes')
    router.refresh()
  }

  return (
    <div className="max-w-lg">
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
              <input {...register('start_time')} type="time" className={inputClass} />
              {errors.start_time && <p className="text-xs text-red-600">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Jam Selesai <span className="text-red-500">*</span>
              </label>
              <input {...register('end_time')} type="time" className={inputClass} />
              {errors.end_time && <p className="text-xs text-red-600">{errors.end_time.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Lokasi</label>
            <input
              {...register('location')}
              placeholder="Contoh: Studio A, GOR Mandiri Lt.2"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Kapasitas</label>
            <input
              {...register('capacity')}
              type="number"
              min="1"
              placeholder="Kosongkan jika tidak terbatas"
              className={inputClass}
            />
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

          <p className="text-xs text-gray-400">Sesi akan dibuat otomatis untuk 8 minggu ke depan.</p>

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
