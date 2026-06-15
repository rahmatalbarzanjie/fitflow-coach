'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const schema = z.object({
  name:  z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor HP minimal 8 digit').regex(/^[0-9+\-\s]+$/, 'Format nomor tidak valid'),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function NewMemberPage() {
  const [serverError, setServerError]     = useState<string | null>(null)
  const [photoFile, setPhotoFile]         = useState<File | null>(null)
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member, error } = await (supabase.from('members') as any)
      .insert({ name: data.name, phone: data.phone, notes: data.notes || null, user_id: user.id })
      .select('id')
      .single()

    if (error) {
      setServerError(error.code === '23505' ? 'Nomor HP sudah terdaftar untuk member lain.' : error.message)
      return
    }

    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()
      const path = `${member.id}/${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage
        .from('member-photos')
        .upload(path, photoFile, { cacheControl: '3600', upsert: true })
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('member-photos').getPublicUrl(uploadData.path)
        if (urlData?.publicUrl) {
          await (supabase.from('members') as any).update({ photo_url: urlData.publicUrl }).eq('id', member.id)
        }
      }
    }

    router.push(`/members/${member.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Tambah Member</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {serverError}
            </div>
          )}

          {/* Photo */}
          <div className="flex flex-col items-center gap-3 pb-2">
            <label className="relative cursor-pointer group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center">
                {photoPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  : <User className="w-10 h-10 text-violet-400" />
                }
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-violet-600 text-white rounded-full flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
            </label>
            <p className="text-xs text-gray-400">Foto opsional — klik untuk upload atau foto langsung</p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              autoFocus
              placeholder="Contoh: Siti Rahayu"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nomor HP <span className="text-red-500">*</span>
            </label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="08xxxxxxxxxx"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            <p className="text-xs text-gray-400">Dipakai untuk broadcast WhatsApp</p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Catatan
              <span className="text-gray-400 font-normal ml-1 text-xs">(opsional)</span>
            </label>
            <input
              {...register('notes')}
              placeholder="Contoh: alergi lutut kiri, langganan 3 bulan..."
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Save button */}
          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-2xl text-base font-bold transition-colors"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Member'}
            </button>
            <div className="text-center">
              <Link
                href="/members"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Batal
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
