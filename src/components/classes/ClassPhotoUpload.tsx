'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, Image as ImageIcon, AlertCircle, CheckCircle } from 'lucide-react'

interface Props {
  classId: string
  currentUrl?: string | null
}

export function ClassPhotoUpload({ classId, currentUrl }: Props) {
  const supabase = createClient()
  const [url,       setUrl]       = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [status,    setStatus]    = useState<'idle' | 'ok' | 'err'>('idle')
  const [errMsg,    setErrMsg]    = useState('')

  async function handleFile(file: File) {
    setUploading(true)
    setStatus('idle')

    const ext  = file.name.split('.').pop()
    const path = `${classId}/${Date.now()}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from('class-covers')
      .upload(path, file, { cacheControl: '3600', upsert: true })

    if (uploadErr || !data) {
      setStatus('err')
      setErrMsg(uploadErr?.message ?? 'Upload gagal')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('class-covers').getPublicUrl(data.path)
    const publicUrl = urlData?.publicUrl ?? null

    if (!publicUrl) {
      setStatus('err')
      setErrMsg('Gagal mendapatkan URL foto')
      setUploading(false)
      return
    }

    const { error: dbErr } = await supabase
      .from('classes')
      .update({ cover_image_url: publicUrl })
      .eq('id', classId)

    if (dbErr) {
      setStatus('err')
      setErrMsg('Foto terupload tapi gagal disimpan: ' + dbErr.message)
      setUploading(false)
      return
    }

    setUrl(publicUrl)
    setStatus('ok')
    setUploading(false)
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <div className="flex items-center gap-4">
      <label className="relative cursor-pointer group shrink-0">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center ring-2 ring-gray-200 ring-offset-2">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="foto kelas" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-300" />
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
      <div>
        <p className="text-sm font-medium text-gray-700">Foto Kelas</p>
        <p className="text-xs text-gray-400">Tampil di jadwal landing page. Klik foto untuk upload.</p>
        {status === 'ok' && (
          <p className="flex items-center gap-1 text-xs text-green-600 mt-1">
            <CheckCircle className="w-3.5 h-3.5" /> Tersimpan
          </p>
        )}
        {status === 'err' && (
          <p className="flex items-start gap-1 text-xs text-red-600 mt-1 max-w-[220px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {errMsg}
          </p>
        )}
      </div>
    </div>
  )
}
