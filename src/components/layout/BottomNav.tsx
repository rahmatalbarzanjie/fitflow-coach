'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Calendar, Zap, Receipt, MoreHorizontal,
  Users2, Package, Wallet, MessageSquare, Settings, PenSquare, X,
  UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const instructorMainItems = [
  { href: '/',         icon: LayoutDashboard, label: 'Beranda' },
  { href: '/members',  icon: Users,           label: 'Member'  },
  { href: '/classes',  icon: Calendar,        label: 'Kelas'   },
  { href: '/events',   icon: Zap,             label: 'Event'   },
  { href: '/laporan',  icon: Receipt,         label: 'Laporan' },
]

const instructorMoreItems = [
  { href: '/content',          icon: PenSquare,     label: 'Buat Konten'       },
  { href: '/community',        icon: Users2,        label: 'Komunitas'         },
  { href: '/packages',         icon: Package,       label: 'Paket Membership'  },
  { href: '/payment-profiles', icon: Wallet,        label: 'Metode Pembayaran' },
  { href: '/broadcasts',       icon: MessageSquare, label: 'Broadcast'         },
  { href: '/settings',         icon: Settings,      label: 'Pengaturan'        },
]

const adminMainItems = [
  { href: '/admin',             icon: LayoutDashboard, label: 'Overview'   },
  { href: '/admin/instructors', icon: UserCog,         label: 'Instruktur' },
  { href: '/admin/members',     icon: Users,           label: 'Member'     },
  { href: '/admin/classes',     icon: Calendar,        label: 'Kelas'      },
]

const adminMoreItems = [
  { href: '/admin/config', icon: Settings, label: 'Config' },
]

export function BottomNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (!adminEmail) return
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.email === adminEmail)
    })
  }, [])

  const mainItems = isAdmin ? adminMainItems : instructorMainItems
  const moreItems = isAdmin ? adminMoreItems : instructorMoreItems

  function isActive(href: string) {
    if (isAdmin) {
      if (href === '/admin') return pathname === '/admin'
      return pathname.startsWith(href)
    }
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  const isMoreActive = moreItems.some(item => isActive(item.href))

  function handleMoreNavClick() {
    setMoreOpen(false)
  }

  return (
    <>
      {/* Drawer overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Drawer sheet */}
      <div className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-lg md:hidden transition-transform duration-200',
        moreOpen ? 'translate-y-0' : 'translate-y-full'
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Menu Lainnya</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 pb-6 safe-area-bottom space-y-0.5">
          {moreItems.map(({ href, icon: Icon, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={handleMoreNavClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                  active
                    ? 'bg-violet-50 text-violet-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-violet-600' : 'text-gray-400')} />
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 md:hidden safe-area-bottom">
        <div className="flex">
          {mainItems.map(({ href, icon: Icon, label }) => {
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

          {/* "Lainnya" button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center py-2 gap-0.5 text-[9px] font-medium transition-colors',
              isMoreActive ? 'text-violet-600' : 'text-gray-400'
            )}
          >
            <MoreHorizontal className={cn('w-5 h-5', isMoreActive ? 'text-violet-600' : 'text-gray-400')} />
            Lainnya
          </button>
        </div>
      </nav>
    </>
  )
}