'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Calendar, Zap,
  MessageSquare, Settings, LogOut, Activity, Shield, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/',           icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/members',    icon: Users,           label: 'Members'    },
  { href: '/classes',    icon: Calendar,        label: 'Kelas'      },
  { href: '/events',     icon: Zap,             label: 'Events'     },
  { href: '/broadcasts', icon: MessageSquare,   label: 'Broadcast'  },
  { href: '/settings',   icon: Settings,        label: 'Pengaturan' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
      if (adminEmail && user?.email === adminEmail) setIsAdmin(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleNavClick() {
    // Close sidebar on mobile after nav
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
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">FitFlow Coach</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Dashboard Instruktur</p>
            </div>
          </div>
          {/* Close button (mobile) */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/'
              ? pathname === '/'
              : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
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

        {/* Admin / Developer link (only for admin email) */}
        {isAdmin && (
          <div className="px-3 pb-1">
            <Link
              href="/admin"
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                pathname.startsWith('/admin')
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              )}
            >
              <Shield className="h-4 w-4 shrink-0" />
              Developer
            </Link>
          </div>
        )}

        {/* Logout */}
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
