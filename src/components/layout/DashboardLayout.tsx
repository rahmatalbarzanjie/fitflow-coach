'use client'

import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useState, useEffect } from 'react'
import { Menu, Settings } from 'lucide-react'
import Link from 'next/link'

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
      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <Sidebar open={open} onClose={() => setOpen(false)} />
      </div>

      <div className={`transition-all duration-200 ${open ? 'md:ml-60' : ''}`}>
        {/* Sticky top bar */}
        <header className="sticky top-0 z-10 h-12 bg-white/90 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(!open)}
              className="hidden md:flex p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              aria-label="Buka/tutup menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {title && <span className="text-sm font-semibold text-gray-900">{title}</span>}
          </div>
          <Link
            href="/settings"
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Pengaturan"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </header>

        {/* pb-20 on mobile for bottom nav clearance */}
        <main className="p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  )
}
