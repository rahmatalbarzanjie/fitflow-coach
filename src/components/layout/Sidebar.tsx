'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Zap, MessageSquare, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',           icon: LayoutDashboard, label: 'Beranda'   },
  { href: '/members',    icon: Users,           label: 'Member'    },
  { href: '/classes',    icon: Calendar,        label: 'Kelas'     },
  { href: '/events',     icon: Zap,             label: 'Events'    },
  { href: '/broadcasts', icon: MessageSquare,   label: 'Broadcast' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname()

  function handleNavClick() {
    if (window.innerWidth < 768) onClose()
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-100 flex flex-col z-30 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Brand */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">FitFlow Coach</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Dashboard Instruktur</p>
          </div>
        </div>

        {/* Navigation — 5 items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                  isActive
                    ? 'bg-violet-50 text-violet-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-violet-600' : 'text-gray-400')} />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
