'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, User, AlertCircle, CheckCircle } from 'lucide-react'

interface Props {
  profileId: string
  currentPhotoUrl?: string | null
  onUploaded?: (url: string) => void
}

async function resizeImage(file: File, maxPx = 800): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx }
        else                { width  = Math.round(width  * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('resize failed')), 'image/jpeg', 0.85)
    }
    img.onerror = () => reject(new Error('load failed'))
    img.src = url
  })
}

export function InstructorPhotoUpload({ profileId, currentPhotoUrl, onUploaded }: Props) {
  const [photoUrl,  setPhotoUrl]  = useState<string | null>(currentPhotoUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [status,    setStatus]    = useState<'idle' | 'ok' | 'err'>('idle')
  const [errMsg,    setErrMsg]    = useState('')
  const supabase = createClient()

  async function handleFile(file: File) {
    setUploading(true)
    setStatus('idle')

    // Resize before upload
    let blob: Blob
    try {
      blob = await resizeImage(file)
    } catch {
      blob = file
    }

    const path = `${profileId}/${Date.now()}.jpg`
    const { data, error: uploadErr } = await supabase.storage
      .from('instructor-photos')
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true })

    if (uploadErr || !data) {
      setStatus('err')
      setErrMsg(uploadErr?.message ?? 'Upload gagal. Pastikan bucket instructor-photos sudah dibuat dan bersifat Public.')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('instructor-photos').getPublicUrl(data.path)
    const url = urlData?.publicUrl ?? null

    if (!url) {
      setStatus('err')
      setErrMsg('Gagal mendapatkan URL foto. Coba lagi.')
      setUploading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbErr } = await (supabase.from('profiles') as any)
      .update({ photo_url: url })
      .eq('id', profileId)

    if (dbErr) {
      setStatus('err')
      setErrMsg('Foto terupload tapi gagal disimpan ke profil: ' + dbErr.message)
      setUploading(false)
      return
    }

    setPhotoUrl(url)
    setStatus('ok')
    onUploaded?.(url)
    setUploading(false)
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <label className="relative cursor-pointer group">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center shrink-0 ring-2 ring-violet-200 ring-offset-2">
          {uploading ? (
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="foto instruktur" className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-violet-400" />
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center">
          <Camera className="w-3.5 h-3.5" />
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </label>

      {status === 'ok' && (
        <p className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="w-3.5 h-3.5" /> Foto berhasil disimpan ✓
        </p>
      )}
      {status === 'err' && (
        <p className="flex items-start gap-1 text-xs text-red-600 max-w-[220px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {errMsg}
        </p>
      )}
    </div>
  )
}
