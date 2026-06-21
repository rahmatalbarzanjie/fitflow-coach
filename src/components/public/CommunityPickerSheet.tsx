'use client'

import { useState } from 'react'
import { Users, X, ChevronRight } from 'lucide-react'

interface Group {
  type: string
  label: string
  link: string
}

export function CommunityPickerSheet({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false)
  if (groups.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gradient inline-flex items-center gap-2 text-white font-bold px-10 py-4 rounded-full shadow-lg hover:opacity-90 hover:scale-105 transition-all"
      >
        <Users className="w-5 h-5" />
        Pilih Komunitas
      </button>

      {open && (
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
                Pilih Komunitas
              </p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-1">
              {groups.map(g => (
                <a
                  key={g.type}
                  href={g.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2.5 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800">Gabung Grup {g.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
