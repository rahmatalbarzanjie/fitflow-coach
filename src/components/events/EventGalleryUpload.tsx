'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, X, ChevronUp, ChevronDown } from 'lucide-react'

interface Photo {
  id: string
  image_url: string
  sort_order: number
}

interface Props {
  eventId: string
  userId: string
  initialPhotos: Photo[]
}

export function EventGalleryUpload({ eventId, userId, initialPhotos }: Props) {
  const supabase = createClient()
  const [photos,    setPhotos]    = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)

    const ext  = file.name.split('.').pop()
    const path = `${eventId}/${Date.now()}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from('event-gallery')
      .upload(path, file, { cacheControl: '3600', upsert: true })

    if (uploadErr || !data) {
      setError(uploadErr?.message ?? 'Upload gagal')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('event-gallery').getPublicUrl(data.path)
    const publicUrl = urlData?.publicUrl ?? null
    if (!publicUrl) {
      setError('Gagal mendapatkan URL foto')
      setUploading(false)
      return
    }

    const nextOrder = photos.length > 0 ? Math.max(...photos.map(p => p.sort_order)) + 1 : 0
    const { data: row, error: dbErr } = await supabase
      .from('event_gallery')
      .insert({ user_id: userId, event_id: eventId, image_url: publicUrl, sort_order: nextOrder })
      .select('id, image_url, sort_order')
      .single()

    if (dbErr || !row) {
      setError(dbErr?.message ?? 'Foto terupload tapi gagal disimpan')
      setUploading(false)
      return
    }

    setPhotos(prev => [...prev, row as Photo])
    setUploading(false)
  }

  async function removePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id))
    await supabase.from('event_gallery').delete().eq('id', id)
  }

  async function move(id: string, dir: -1 | 1) {
    const idx     = photos.findIndex(p => p.id === id)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= photos.length) return

    const next = [...photos]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setPhotos(next)

    await Promise.all(next.map((p, i) => supabase.from('event_gallery').update({ sort_order: i }).eq('id', p.id)))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {photos.map((p, i) => (
          <div key={p.id} className="relative w-20 h-20 rounded-xl overflow-hidden ring-2 ring-gray-200 ring-offset-2 group shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt="dokumentasi event" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(p.id)}
              className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute bottom-0.5 left-0.5 flex gap-0.5">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(p.id, -1)}
                className="bg-black/50 disabled:opacity-30 text-white rounded p-0.5"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={i === photos.length - 1}
                onClick={() => move(p.id, 1)}
                className="bg-black/50 disabled:opacity-30 text-white rounded p-0.5"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 bg-gray-50 hover:bg-violet-50 flex items-center justify-center cursor-pointer transition-all shrink-0">
          {uploading ? (
            <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-gray-400" />
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">
        Foto dokumentasi event. Tampil di landing page setelah event ini berstatus selesai (maks 6 foto/event).
      </p>
    </div>
  )
}
