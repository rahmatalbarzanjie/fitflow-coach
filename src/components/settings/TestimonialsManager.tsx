'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, Trash2, User } from 'lucide-react'

interface Testimonial {
  id: string
  name: string
  content: string
  photo_url: string | null
  is_published: boolean
  created_at: string
}

interface Props {
  initialTestimonials: Testimonial[]
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function TestimonialsManager({ initialTestimonials }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open,    setOpen]    = useState(false)
  const [name,    setName]    = useState('')
  const [content, setContent] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function submit() {
    if (!name.trim() || !content.trim()) {
      setError('Nama dan isi testimoni wajib diisi')
      return
    }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    let photoUrl: string | null = null
    if (photoFile) {
      const path = `testimonials/${user.id}/${Date.now()}.jpg`
      const { data, error: upErr } = await supabase.storage
        .from('instructor-photos')
        .upload(path, photoFile, { cacheControl: '3600', upsert: true })
      if (!upErr && data) {
        const { data: urlData } = supabase.storage.from('instructor-photos').getPublicUrl(data.path)
        photoUrl = urlData?.publicUrl ?? null
      }
    }

    const { error: insertErr } = await supabase.from('testimonials').insert({
      user_id:   user.id,
      name:      name.trim(),
      content:   content.trim(),
      photo_url: photoUrl,
    })

    setSaving(false)
    if (insertErr) { setError(insertErr.message); return }

    setName(''); setContent(''); setPhotoFile(null); setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    setDeletingId(id)
    await supabase.from('testimonials').delete().eq('id', id)
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {initialTestimonials.length > 0 && (
        <div className="space-y-2">
          {initialTestimonials.map(t => (
            <div key={t.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                {t.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.photo_url} alt={t.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-violet-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                </div>
              </div>
              <button
                onClick={() => remove(t.id)}
                disabled={deletingId === t.id}
                className="text-gray-300 hover:text-red-500 shrink-0 disabled:opacity-50"
              >
                {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama pemberi testimoni" className={inp} />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="Isi testimoni..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
              className="text-xs text-gray-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setError('') }}
              disabled={saving}
              className="h-9 px-3 text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Simpan
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Testimoni
        </button>
      )}
    </div>
  )
}
