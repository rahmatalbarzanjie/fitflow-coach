'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { memberSchema, type MemberFormData } from '@/lib/validations/member'
import { Check } from 'lucide-react'
import { MemberPhotoUpload } from './MemberPhotoUpload'

interface Props {
  member: {
    id: string
    name: string
    phone: string
    notes?: string | null
    address?: string | null
    instagram?: string | null
    photo_url?: string | null
  }
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

export function MemberEditForm({ member }: Props) {
  const [saved, setSaved]             = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name:      member.name,
      phone:     member.phone,
      notes:     member.notes     ?? '',
      address:   member.address   ?? '',
      instagram: member.instagram ?? '',
    },
  })

  async function onSubmit(data: MemberFormData) {
    setServerError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('members') as any)
      .update({
        name:      data.name,
        phone:     data.phone,
        notes:     data.notes     || null,
        address:   data.address   || null,
        instagram: data.instagram || null,
      })
      .eq('id', member.id)

    if (error) {
      setServerError(error.code === '23505' ? 'Nomor HP sudah digunakan member lain.' : error.message)
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {serverError}
        </div>
      )}

      {/* Photo */}
      <div className="flex items-center gap-4 pb-2">
        <MemberPhotoUpload memberId={member.id} currentPhotoUrl={member.photo_url} />
        <div>
          <p className="text-sm font-medium text-gray-700">Foto Profil</p>
          <p className="text-xs text-gray-400 mt-0.5">Klik foto untuk upload atau ambil dari kamera</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Nama</label>
          <input {...register('name')} className={inp} />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Nomor HP</label>
          <input {...register('phone')} type="tel" className={inp} />
          {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Alamat
          <span className="text-gray-400 font-normal ml-1 text-xs">(untuk pengiriman / info lain)</span>
        </label>
        <textarea
          {...register('address')}
          rows={2}
          placeholder="Jl. Contoh No. 1, Kelurahan, Kota..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Instagram</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
            <input
              {...register('instagram')}
              className="w-full h-9 pl-7 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="username"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Catatan</label>
          <input
            {...register('notes')}
            placeholder="Catatan tambahan..."
            className={inp}
          />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saved ? <><Check className="h-4 w-4" /> Tersimpan</> : isSubmitting ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}
