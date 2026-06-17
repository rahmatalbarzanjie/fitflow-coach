'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Users2, UserCog, Calendar, Zap, PenSquare, MessageSquare, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const instructorItems = [
  { href: '/',           icon: LayoutDashboard, label: 'Beranda'   },
  { href: '/members',    icon: Users,           label: 'Member'    },
  { href: '/community',  icon: Users2,          label: 'Komunitas' },
  { href: '/classes',    icon: Calendar,        label: 'Kelas'     },
  { href: '/events',     icon: Zap,             label: 'Event'     },
  { href: '/content',    icon: PenSquare,       label: 'Konten'    },
  { href: '/broadcasts', icon: MessageSquare,   label: 'Broadcast' },
]

const adminItems = [
  { href: '/admin',             icon: LayoutDashboard, label: 'Overview'   },
  { href: '/admin/instructors', icon: UserCog,         label: 'Instruktur' },
  { href: '/admin/members',     icon: Users,           label: 'Member'     },
  { href: '/admin/classes',     icon: Calendar,        label: 'Kelas'      },
  { href: '/admin/config',      icon: Settings,        label: 'Config'     },
]

export function BottomNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (!adminEmail) return
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.email === adminEmail)
    })
  }, [])

  const items = isAdmin ? adminItems : instructorItems

  function isActive(href: string) {
    if (isAdmin) {
      if (href === '/admin') return pathname === '/admin'
      return pathname.startsWith(href)
    }
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 md:hidden safe-area-bottom">
      <div className="flex">
        {items.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center py-2 gap-0.5 text-[9px] font-medium transition-colors',
                active ? 'text-violet-600' : 'text-gray-400'
              )}
            >
              <Icon className={cn('w-5 h-5', active ? 'text-violet-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
