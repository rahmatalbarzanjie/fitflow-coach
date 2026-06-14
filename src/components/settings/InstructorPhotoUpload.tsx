'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, User } from 'lucide-react'

interface Props {
  profileId: string
  currentPhotoUrl?: string | null
  onUploaded?: (url: string) => void
}

export function InstructorPhotoUpload({ profileId, currentPhotoUrl, onUploaded }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  async function handleFile(file: File) {
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${profileId}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('instructor-photos')
      .upload(path, file, { cacheControl: '3600', upsert: true })

    if (!error && data) {
      const { data: urlData } = supabase.storage.from('instructor-photos').getPublicUrl(data.path)
      const url = urlData?.publicUrl ?? null
      if (url) {
        setPhotoUrl(url)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any).update({ photo_url: url }).eq('id', profileId)
        onUploaded?.(url)
      }
    }
    setUploading(false)
  }

  return (
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
      <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Camera className="w-3.5 h-3.5" />
      </div>
      <input
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        disabled={uploading}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </label>
  )
}
