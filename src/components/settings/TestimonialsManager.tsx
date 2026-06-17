'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Trash2, User, Star, Check } from 'lucide-react'

interface Testimonial {
  id: string
  name: string
  content: string
  photo_url: string | null
  is_published: boolean
  rating?: number
  created_at: string
}

interface Props {
  initialTestimonials: Testimonial[]
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`w-3 h-3 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  )
}

export function TestimonialsManager({ initialTestimonials }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open,    setOpen]    = useState(false)
  const [name,    setName]    = useState('')
  const [content, setContent] = useState('')
  const [rating,  setRating]  = useState(5)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [busyId,  setBusyId]  = useState<string | null>(null)

  const pending  = initialTestimonials.filter(t => !t.is_published)
  const approved = initialTestimonials.filter(t => t.is_published)

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
      user_id:      user.id,
      name:         name.trim(),
      content:      content.trim(),
      rating,
      photo_url:    photoUrl,
      is_published: true,
    })

    setSaving(false)
    if (insertErr) { setError(insertErr.message); return }

    setName(''); setContent(''); setRating(5); setPhotoFile(null); setOpen(false)
    router.refresh()
  }

  async function approve(id: string) {
    setBusyId(id)
    await supabase.from('testimonials').update({ is_published: true }).eq('id', id)
    setBusyId(null)
    router.refresh()
  }

  async function remove(id: string) {
    setBusyId(id)
    await supabase.from('testimonials').delete().eq('id', id)
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
            Menunggu Persetujuan ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {t.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photo_url} alt={t.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-amber-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    {typeof t.rating === 'number' && <Stars rating={t.rating} />}
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{t.content}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => approve(t.id)}
                    disabled={busyId === t.id}
                    className="h-7 px-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {busyId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Setujui
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    disabled={busyId === t.id}
                    className="text-gray-300 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          {pending.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sudah Tayang</p>}
          <div className="space-y-2">
            {approved.map(t => (
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
                    {typeof t.rating === 'number' && <Stars rating={t.rating} />}
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{t.content}</p>
                  </div>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  disabled={busyId === t.id}
                  className="text-gray-300 hover:text-red-500 shrink-0 disabled:opacity-50"
                >
                  {busyId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {open ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama pemberi testimoni" className={inp} />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                <Star className={`w-5 h-5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
              </button>
            ))}
          </div>
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
