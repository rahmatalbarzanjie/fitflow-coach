'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, User } from 'lucide-react'

interface Props {
  memberId: string
  currentPhotoUrl?: string | null
  onUploaded?: (url: string) => void
  size?: 'sm' | 'lg'
}

export function MemberPhotoUpload({ memberId, currentPhotoUrl, onUploaded, size = 'lg' }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const dim = size === 'lg' ? 'w-20 h-20' : 'w-10 h-10'
  const iconDim = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5'
  const camDim  = size === 'lg' ? 'w-6 h-6 p-1' : 'w-4 h-4 p-0.5'

  async function handleFile(file: File) {
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${memberId}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('member-photos')
      .upload(path, file, { cacheControl: '3600', upsert: true })

    if (!error && data) {
      const { data: urlData } = supabase.storage.from('member-photos').getPublicUrl(data.path)
      const url = urlData?.publicUrl ?? null
      if (url) {
        setPhotoUrl(url)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('members') as any).update({ photo_url: url }).eq('id', memberId)
        onUploaded?.(url)
      }
    }
    setUploading(false)
  }

  return (
    <label className="relative cursor-pointer group">
      <div className={`${dim} rounded-full overflow-hidden bg-violet-100 flex items-center justify-center shrink-0`}>
        {uploading ? (
          <Loader2 className={`${iconDim} text-violet-400 animate-spin`} />
        ) : photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="foto" className="w-full h-full object-cover" />
        ) : (
          <User className={`${iconDim} text-violet-400`} />
        )}
      </div>
      <div className={`absolute -bottom-0.5 -right-0.5 ${camDim} bg-violet-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
        <Camera className="w-full h-full" />
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

// Static avatar (no upload) - used in lists
export function MemberAvatar({ photoUrl, name, size = 'sm' }: { photoUrl?: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim     = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
  const textDim = size === 'lg' ? 'text-base'  : size === 'md' ? 'text-sm'  : 'text-xs'
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={name} className={`${dim} rounded-full object-cover shrink-0`} />
    )
  }
  return (
    <div className={`${dim} rounded-full bg-violet-100 flex items-center justify-center shrink-0`}>
      <span className={`${textDim} font-semibold text-violet-600`}>{initials}</span>
    </div>
  )
}
