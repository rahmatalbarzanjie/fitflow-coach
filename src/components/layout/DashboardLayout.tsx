'use client'

import { Sidebar } from './Sidebar'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'

interface Props {
  children: React.ReactNode
  title?: string
}

export function DashboardLayout({ children, title }: Props) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className={`transition-all duration-200 ${open ? 'md:ml-60' : ''}`}>
        {/* Sticky top bar — burger always visible */}
        <header className="sticky top-0 z-10 h-12 bg-white/90 backdrop-blur-sm border-b border-gray-100 flex items-center gap-3 px-4">
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            aria-label="Buka/tutup menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {title && <span className="text-sm font-semibold text-gray-900">{title}</span>}
        </header>

        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
