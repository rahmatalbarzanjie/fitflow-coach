'use client'

import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { RoutePerfTracker } from '@/components/dev/RoutePerfTracker'

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
      <RoutePerfTracker />
      <div className="hidden md:block">
        <Sidebar open={open} onClose={() => setOpen(false)} />
      </div>

      <div className={`transition-all duration-200 ${open ? 'md:ml-60' : ''}`}>
        <header className="sticky top-0 z-10 h-12 bg-white/90 backdrop-blur-sm border-b border-gray-100 flex items-center px-4">
          <button
            onClick={() => setOpen(!open)}
            className="hidden md:flex p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            aria-label="Buka/tutup menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {title && <span className="text-sm font-semibold text-gray-900 md:ml-2">{title}</span>}
        </header>

        <main className="p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}