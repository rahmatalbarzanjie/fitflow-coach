'use client'

import { useState } from 'react'
import { ImageLightbox, type LightboxImage } from './ImageLightbox'

interface GalleryPhoto {
  id: string
  url: string
  alt?: string
}

interface Props {
  photos: GalleryPhoto[]
  extraCount?: number
}

export function GalleryGrid({ photos, extraCount = 0 }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const lightboxImages: LightboxImage[] = photos.map(p => ({ url: p.url, alt: p.alt }))

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square rounded-xl overflow-hidden cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.alt ?? ''}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {i === photos.length - 1 && extraCount > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-bold">
                +{extraCount} foto lainnya
              </div>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  )
}
