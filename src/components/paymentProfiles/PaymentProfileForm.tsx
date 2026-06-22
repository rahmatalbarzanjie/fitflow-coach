'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { paymentProfileSchema, type PaymentProfileFormData } from '@/lib/validations/paymentProfile'

interface Props {
  profile?: { id: string; name: string; is_active: boolean }
  classCount?: number
  eventCount?: number
}

const inputClass = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function PaymentProfileForm({ profile, classCount = 0, eventCount = 0 }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [retiring, setRetiring] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PaymentProfileFormData>({
    resolver: zodResolver(paymentProfileSchema),
    defaultValues: { name: profile?.name ?? '' },
  })

  async function onSubmit(data: PaymentProfileFormData) {
    setServerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (profile) {
      const { error } = await supabase.from('payment_profiles').update({ name: data.name }).eq('id', profile.id)
      if (error) { setServerError(error.message); return }
      router.refresh()
    } else {
      const { data: row, error } = await supabase
        .from('payment_profiles')
        .insert({ user_id: user.id, name: data.name })
        .select('id')
        .single()
      if (error || !row) { setServerError(error?.message ?? 'Gagal membuat profile'); return }
      router.push(`/payment-profiles/${row.id}`)
      router.refresh()
    }
  }

  async function toggleActive() {
    if (!profile) return
    setRetiring(true)
    await supabase.from('payment_profiles').update({ is_active: !profile.is_active }).eq('id', profile.id)
    setRetiring(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{serverError}</div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nama Payment Profile</label>
        <input {...register('name')} placeholder="Contoh: Nana Personal, Keyra Studio" className={inputClass} autoFocus />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex items-center justify-end gap-3">
        {profile && (
          <button
            type="button"
            onClick={toggleActive}
            disabled={retiring}
            className="h-9 px-4 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {retiring ? 'Memproses...' : profile.is_active ? 'Nonaktifkan' : 'Aktifkan Lagi'}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : profile ? 'Simpan' : 'Buat Profile'}
        </button>
      </div>

      {profile && !profile.is_active && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
          Profile ini nonaktif - tidak muncul di pilihan baru untuk Class/Event/Package.
          {classCount + eventCount > 0 ? (
            <> Saat ini masih dipakai oleh {classCount > 0 && `${classCount} kelas`}{classCount > 0 && eventCount > 0 && ' dan '}{eventCount > 0 && `${eventCount} event`} aktif - mereka tetap berjalan normal, tapi pastikan Anda sudah siapkan pengganti untuk pendaftaran baru.</>
          ) : (
            <> Tidak ada kelas/event aktif yang memakainya saat ini.</>
          )}
        </p>
      )}
    </form>
  )
}
