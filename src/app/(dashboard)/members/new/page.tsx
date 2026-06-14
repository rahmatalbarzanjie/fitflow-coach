'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { memberSchema, type MemberFormData } from '@/lib/validations/member'

export default function NewMemberPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [photoFile, setPhotoFile]     = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function onSubmit(data: MemberFormData) {
    setServerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member, error } = await (supabase.from('members') as any)
      .insert({ name: data.name, phone: data.phone, notes: data.notes || null, address: data.address || null, instagram: data.instagram || null, user_id: user.id })
      .select('id')
      .single()

    if (error) {
      setServerError(error.code === '23505' ? 'Nomor HP sudah terdaftar untuk member lain.' : error.message)
      return
    }

    // Upload photo if selected
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()
      const path = `${member.id}/${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage
        .from('member-photos')
        .upload(path, photoFile, { cacheControl: '3600', upsert: true })
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('member-photos').getPublicUrl(uploadData.path)
        if (urlData?.publicUrl) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('members') as any).update({ photo_url: urlData.publicUrl }).eq('id', member.id)
        }
      }
    }

    router.push(`/members/${member.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Tambah Member</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {serverError}
            </div>
          )}

          {/* Photo */}
          <div className="flex items-center gap-4 pb-2">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center">
                {photoPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  : <User className="w-8 h-8 text-violet-400" />
                }
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
            </label>
            <div>
              <p className="text-sm font-medium text-gray-700">Foto Profil</p>
              <p className="text-xs text-gray-400 mt-0.5">Opsional — klik untuk upload atau ambil dari kamera</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              autoFocus
              placeholder="Contoh: Siti Rahayu"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nomor HP <span className="text-red-500">*</span>
            </label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="08xxxxxxxxxx"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            <p className="text-xs text-gray-400">Akan dipakai untuk broadcast WhatsApp</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Alamat
              <span className="text-gray-400 font-normal ml-1 text-xs">(opsional)</span>
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
                  placeholder="username"
                  className="w-full h-9 pl-7 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Catatan</label>
              <input
                {...register('notes')}
                placeholder="Catatan tambahan..."
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Link
              href="/members"
              className="flex-1 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
