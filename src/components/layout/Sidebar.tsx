'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Users2, UserCog, Calendar, Zap, PenSquare, MessageSquare,
  Activity, Settings, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const instructorItems = [
  { href: '/',           icon: LayoutDashboard, label: 'Beranda'      },
  { href: '/members',    icon: Users,           label: 'Member'       },
  { href: '/community',  icon: Users2,          label: 'Komunitas'    },
  { href: '/classes',    icon: Calendar,        label: 'Kelas'        },
  { href: '/events',     icon: Zap,             label: 'Events'       },
  { href: '/content',    icon: PenSquare,       label: 'Buat Konten'  },
  { href: '/broadcasts', icon: MessageSquare,   label: 'Broadcast'    },
]

const adminItems = [
  { href: '/admin',             icon: LayoutDashboard, label: 'Overview'        },
  { href: '/admin/instructors', icon: UserCog,         label: 'Instruktur'      },
  { href: '/admin/members',     icon: Users,           label: 'Semua Member'    },
  { href: '/admin/community',   icon: Users2,          label: 'Semua Komunitas' },
  { href: '/admin/classes',     icon: Calendar,        label: 'Semua Kelas'     },
  { href: '/admin/events',      icon: Zap,             label: 'Semua Event'     },
  { href: '/admin/broadcasts',  icon: MessageSquare,   label: 'Semua Broadcast' },
  { href: '/admin/config',      icon: Settings,        label: 'Konfigurasi'     },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const pathname  = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (!adminEmail) return
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.email === adminEmail)
    })
  }, [])

  const items = isAdmin ? adminItems : instructorItems

  function handleNavClick() {
    if (window.innerWidth < 768) onClose()
  }

  function isActive(href: string) {
    if (isAdmin) {
      if (href === '/admin') return pathname === '/admin'
      return pathname.startsWith(href)
    }
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
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
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
            isAdmin ? 'bg-gray-900' : 'bg-violet-600'
          )}>
            {isAdmin ? <Shield className="w-4 h-4 text-white" /> : <Activity className="w-4 h-4 text-white" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">FitFlow Coach</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {isAdmin ? 'Admin Panel' : 'Dashboard Instruktur'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {items.map(({ href, icon: Icon, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                  active
                    ? isAdmin
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'bg-violet-50 text-violet-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4 shrink-0',
                  active
                    ? isAdmin ? 'text-gray-700' : 'text-violet-600'
                    : 'text-gray-400'
                )} />
                {label}
              </Link>
            )
          })}

          {/* Settings link - instructor only */}
          {!isAdmin && (
            <Link
              href="/settings"
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mt-2 border-t border-gray-100 pt-4',
                pathname.startsWith('/settings')
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Pengaturan
            </Link>
          )}
        </nav>
      </aside>
    </>
  )
}
