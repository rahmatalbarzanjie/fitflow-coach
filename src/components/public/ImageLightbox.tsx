'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export type LightboxImage = {
  url: string
  alt?: string
}

interface Props {
  images: LightboxImage[]
  initialIndex: number
  onClose: () => void
}

// Pemanggil selalu render ini lewat conditional `{open && <ImageLightbox/>}`
// (full unmount/remount tiap dibuka/ditutup), jadi initialIndex sebagai nilai
// awal useState sudah cukup - tidak perlu sync logic untuk prop yang berubah
// di instance yang sama, karena itu tidak pernah terjadi di pemakaian ini.
export function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % images.length)
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [images.length, onClose])

  if (images.length === 0) return null
  const current = images[index]

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setIndex(i => (i - 1 + images.length) % images.length) }}
          aria-label="Sebelumnya"
          className="absolute left-2 sm:left-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt ?? ''}
        onClick={e => e.stopPropagation()}
        className="max-w-[92vw] max-h-[85vh] object-contain rounded-lg"
      />

      {images.length > 1 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setIndex(i => (i + 1) % images.length) }}
          aria-label="Selanjutnya"
          className="absolute right-2 sm:right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  )
}
