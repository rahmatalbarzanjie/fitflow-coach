'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check } from 'lucide-react'
import { InstructorPhotoUpload } from './InstructorPhotoUpload'

const profileSchema = z.object({
  name:          z.string().min(2, 'Nama minimal 2 karakter'),
  business_name: z.string().optional(),
  phone:         z.string().min(8, 'Nomor HP minimal 8 digit').regex(/^[0-9+\-\s]+$/, 'Nomor tidak valid'),
  slug:          z.string().min(2).regex(/^[a-z0-9-]+$/, 'Hanya huruf kecil, angka, tanda -'),
  bio:           z.string().max(600, 'Maksimal 600 karakter').optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface Props {
  profile: {
    id: string
    name: string
    business_name: string | null
    phone: string | null
    slug: string | null
    photo_url?: string | null
    bio?: string | null
  }
  appUrl: string
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-gray-50'

export function ProfileForm({ profile, appUrl }: Props) {
  const [saved,       setSaved]       = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name:          profile.name ?? '',
      business_name: profile.business_name ?? '',
      phone:         profile.phone ?? '',
      slug:          profile.slug ?? '',
      bio:           profile.bio ?? '',
    },
  })

  const slug = watch('slug')
  const publicBase = `${appUrl}/${slug}`

  async function onSubmit(data: ProfileFormData) {
    setServerError(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        name:          data.name,
        business_name: data.business_name || null,
        phone:         data.phone,
        slug:          data.slug,
        bio:           data.bio || null,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (error) {
      setServerError(
        error.code === '23505' ? 'Slug sudah dipakai akun lain. Ganti dengan yang lain.' : error.message
      )
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function copyUrl() {
    navigator.clipboard.writeText(publicBase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{serverError}</div>
      )}

      {/* Instructor Photo */}
      <div className="flex items-center gap-4 pb-1">
        <InstructorPhotoUpload profileId={profile.id} currentPhotoUrl={profile.photo_url} />
        <div>
          <p className="text-sm font-medium text-gray-700">Foto Instruktur</p>
          <p className="text-xs text-gray-400 mt-0.5">Tampil di halaman publik / landing page</p>
          <p className="text-xs text-gray-400">Klik foto untuk upload</p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nama Instruktur</label>
        <input {...register('name')} className={inp} />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>

      {/* Business name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nama Studio / Usaha</label>
        <input {...register('business_name')} placeholder="Opsional - tampil di halaman publik" className={inp} />
      </div>

      {/* Phone / WhatsApp */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nomor WhatsApp</label>
        <input {...register('phone')} type="tel" placeholder="08xxxxxxxxxx" className={inp} />
        {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
        <p className="text-xs text-gray-400">Dipakai untuk mengirim broadcast ke member</p>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Biografi
          <span className="text-gray-400 font-normal ml-1 text-xs">(tampil di landing page, di bawah nama)</span>
        </label>
        <textarea
          {...register('bio')}
          rows={3}
          placeholder="Contoh: Instruktur tersertifikasi dengan 5 tahun pengalaman mengajar Zumba dan Poundfit..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {errors.bio && <p className="text-xs text-red-600">{errors.bio.message}</p>}
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Slug URL Publik</label>
        <input {...register('slug')} placeholder="nama-instruktur" className={inp} />
        {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}

        {slug && (
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-mono flex-1 truncate">{publicBase}</p>
            <button
              type="button"
              onClick={copyUrl}
              className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 shrink-0"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Disalin!' : 'Salin'}
            </button>
          </div>
        )}
        <p className="text-xs text-gray-400">
          Mengubah slug akan merusak link event yang sudah disebarkan.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-6 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : saved ? 'Tersimpan ✓' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  )
}
