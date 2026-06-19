'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { X, UserPlus, Camera, User, Loader2 } from 'lucide-react'

const schema = z.object({
  name:  z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor HP minimal 8 digit').regex(/^[0-9+\-\s]+$/, 'Format nomor tidak valid'),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const inp = 'w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

export function AddMemberModal() {
  const router   = useRouter()
  const supabase = createClient()

  const [open,         setOpen        ] = useState(false)
  const [serverError,  setServerError ] = useState<string | null>(null)
  const [photoFile,    setPhotoFile   ] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function handleClose() {
    setOpen(false)
    reset()
    setServerError(null)
    setPhotoFile(null)
    setPhotoPreview(null)
  }

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
      setServerError(
        error.code === '23505'
          ? 'Nomor HP sudah terdaftar untuk member lain.'
          : error.message
      )
      return
    }

    // Upload foto kalau ada
    if (photoFile && member) {
      const ext  = photoFile.name.split('.').pop()
      const path = `${member.id}/${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage
        .from('member-photos')
        .upload(path, photoFile, { cacheControl: '3600', upsert: true })
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('member-photos').getPublicUrl(uploadData.path)
        if (urlData?.publicUrl) {
          await (supabase.from('members') as any)
            .update({ photo_url: urlData.publicUrl })
            .eq('id', member.id)
        }
      }
    }

    handleClose()
    router.refresh()
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Tambah Member
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Tambah Member</h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
              {serverError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                  {serverError}
                </div>
              )}

              {/* Photo */}
              <div className="flex flex-col items-center gap-2 py-1">
                <label className="relative cursor-pointer group">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center">
                    {photoPreview
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                      : <User className="w-9 h-9 text-violet-400" />
                    }
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
                </label>
                <p className="text-xs text-gray-400">Foto opsional</p>
              </div>

              {/* Nama */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name')}
                  autoFocus
                  placeholder="Contoh: Siti Rahayu"
                  className={inp}
                />
                {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
              </div>

              {/* No HP */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Nomor HP <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  className={inp}
                />
                {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
                <p className="text-xs text-gray-400">Dipakai untuk broadcast WhatsApp</p>
              </div>

              {/* Catatan */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Catatan <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <input
                  {...register('notes')}
                  placeholder="Contoh: alergi lutut kiri, langganan 3 bulan..."
                  className={inp}
                />
              </div>

              {/* Footer buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
