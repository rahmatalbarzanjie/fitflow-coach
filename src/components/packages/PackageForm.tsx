'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { membershipPackageSchema, type MembershipPackageFormData } from '@/lib/validations/membershipPackage'
import { CLASS_TYPES } from '@/lib/constants'
import { formatRupiah } from '@/lib/utils'

interface Props {
  pkg?: {
    id: string
    name: string
    package_type: string
    class_type: string | null
    total_sessions: number | null
    duration_days: number | null
    price: number
    is_active: boolean
    payment_profile_id?: string | null
  }
  paymentProfiles?: { id: string; name: string }[]
}

const inputClass = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function PackageForm({ pkg, paymentProfiles = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [retiring, setRetiring] = useState(false)

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<MembershipPackageFormData>({
    resolver: zodResolver(membershipPackageSchema),
    defaultValues: {
      name:           pkg?.name ?? '',
      package_type:   (pkg?.package_type as MembershipPackageFormData['package_type']) ?? 'unlimited',
      class_type:     (pkg?.class_type as MembershipPackageFormData['class_type']) ?? '',
      total_sessions: pkg?.total_sessions ?? undefined,
      duration_days:  pkg?.duration_days ?? undefined,
      price:          pkg?.price ?? 0,
      payment_profile_id: pkg?.payment_profile_id ?? '',
    },
  })

  const packageType = useWatch({ control, name: 'package_type' })
  const price       = useWatch({ control, name: 'price' })

  async function onSubmit(data: MembershipPackageFormData) {
    setServerError(null)

    if (data.package_type === 'session_pack' && !data.total_sessions) {
      setServerError('Total sesi wajib diisi untuk paket Sesi (mis. 10x, 20x)')
      return
    }

    const payload = {
      name:           data.name,
      package_type:   data.package_type,
      class_type:     data.class_type || null,
      total_sessions: data.package_type === 'session_pack' ? data.total_sessions : null,
      duration_days:  data.duration_days || null,
      price:          data.price,
      payment_profile_id: data.payment_profile_id || null,
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = pkg
      ? await supabase.from('membership_packages').update(payload).eq('id', pkg.id)
      : await supabase.from('membership_packages').insert({ ...payload, user_id: user.id })

    if (error) { setServerError(error.message); return }

    router.push('/packages')
    router.refresh()
  }

  async function toggleActive() {
    if (!pkg) return
    setRetiring(true)
    await supabase.from('membership_packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id)
    setRetiring(false)
    router.push('/packages')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nama Paket</label>
        <input {...register('name')} placeholder="Contoh: Barre Unlimited" className={inputClass} autoFocus />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Tipe Paket</label>
          <select {...register('package_type')} className={inputClass}>
            <option value="unlimited">Unlimited</option>
            <option value="session_pack">Paket Sesi (10x, 20x, dst)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Khusus Tipe Kelas</label>
          <select {...register('class_type')} className={inputClass}>
            <option value="">Semua kelas</option>
            {CLASS_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {packageType === 'session_pack' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Total Sesi</label>
            <input {...register('total_sessions')} type="number" min="1" placeholder="10" className={inputClass} />
            {errors.total_sessions && <p className="text-xs text-red-600">{errors.total_sessions.message}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Masa Berlaku (hari)
            <span className="text-gray-400 font-normal ml-1 text-xs">(opsional)</span>
          </label>
          <input {...register('duration_days')} type="number" min="1" placeholder="30" className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Harga (Rp)</label>
        <input {...register('price')} type="number" min="0" placeholder="300000" className={inputClass} />
        {Number(price) > 0 && (
          <p className="text-xs text-gray-400">{formatRupiah(Number(price))}</p>
        )}
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
            Belum ada Payment Profile yang siap. Atur di menu Payment Profiles.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {pkg && (
          <button
            type="button"
            onClick={toggleActive}
            disabled={retiring}
            className="h-9 px-4 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {retiring ? 'Memproses...' : pkg.is_active ? 'Nonaktifkan Paket' : 'Aktifkan Lagi'}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : pkg ? 'Simpan Perubahan' : 'Buat Paket'}
        </button>
      </div>
    </form>
  )
}
