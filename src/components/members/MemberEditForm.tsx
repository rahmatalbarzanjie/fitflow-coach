'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { Check } from 'lucide-react'

const schema = z.object({
  name:  z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor HP minimal 8 digit').regex(/^[0-9+\-\s]+$/, 'Format nomor tidak valid'),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  member: {
    id: string
    name: string
    phone: string
    notes?: string | null
    photo_url?: string | null
  }
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

export function MemberEditForm({ member }: Props) {
  const [saved, setSaved]             = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:  member.name,
      phone: member.phone,
      notes: member.notes ?? '',
    },
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const { error } = await (supabase.from('members') as any)
      .update({
        name:  data.name,
        phone: data.phone,
        notes: data.notes || null,
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

      {/* Nama — vertikal untuk mobile */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
        <input {...register('name')} className={inp} />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>

      {/* HP — vertikal untuk mobile */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nomor HP</label>
        <input {...register('phone')} type="tel" className={inp} />
        {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Catatan</label>
        <input
          {...register('notes')}
          placeholder="Catatan tambahan..."
          className={inp}
        />
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
