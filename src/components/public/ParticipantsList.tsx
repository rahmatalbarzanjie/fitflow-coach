'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Users, X } from 'lucide-react'

export function ParticipantsList({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false)
  // Portal target hanya tersedia di client — guard mount supaya tidak SSR crash
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (names.length === 0) return null

  const preview = names.slice(0, 3).join(', ')

  const modal = open && mounted && createPortal(
    // Portal ke document.body memastikan fixed positioning relatif ke viewport,
    // bukan ke ancestor yang punya transform (ScrollReveal pakai translateY(0)
    // yang membuat stacking context dan menggeser fixed child dari viewport).
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-gray-400" />
            {names.length} Peserta Terdaftar
          </p>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-1">
          {names.map((n, i) => (
            <div key={i} className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-gray-50">
              <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                {n[0]?.toUpperCase()}
              </span>
              <span className="text-sm text-gray-700">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <p className="text-xs text-on-surface-variant/80">
        Sudah daftar: {preview}
        {names.length > 3 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-1 text-violet-600 font-semibold hover:underline"
          >
            +{names.length - 3} lainnya
          </button>
        )}
      </p>
      {modal}
    </>
  )
}
