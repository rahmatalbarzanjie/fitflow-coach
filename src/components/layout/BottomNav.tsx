'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Zap, PenSquare, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/',           icon: LayoutDashboard, label: 'Beranda'  },
  { href: '/members',    icon: Users,           label: 'Member'   },
  { href: '/classes',    icon: Calendar,        label: 'Kelas'    },
  { href: '/events',     icon: Zap,             label: 'Event'    },
  { href: '/content',    icon: PenSquare,       label: 'Konten'   },
  { href: '/broadcasts', icon: MessageSquare,   label: 'Broadcast'},
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 md:hidden safe-area-bottom">
      <div className="flex">
        {items.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center py-2 gap-0.5 text-[9px] font-medium transition-colors',
                isActive ? 'text-violet-600' : 'text-gray-400'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-violet-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
