'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_TABS = [
  { value: 'all',      label: 'Semua'       },
  { value: 'active',   label: 'Aktif'       },
  { value: 'new',      label: 'Baru'        },
  { value: 'at_risk',  label: 'Perlu Follow Up' },
  { value: 'inactive', label: 'Tidak Aktif' },
]

interface Props {
  currentSearch: string
  currentStatus: string
  counts: Record<string, number>
  total: number
}

export function MembersSearch({ currentSearch, currentStatus, counts, total }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  function push(search: string, status: string) {
    const p = new URLSearchParams()
    if (search)           p.set('search', search)
    if (status !== 'all') p.set('status', status)
    startTransition(() => router.push(`${pathname}?${p.toString()}`))
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          defaultValue={currentSearch}
          onChange={e => push(e.target.value, currentStatus)}
          placeholder="Cari nama atau nomor HP..."
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
        />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(({ value, label }) => {
          const count    = value === 'all' ? total : (counts[value] ?? 0)
          const isActive = currentStatus === value
          return (
            <button
              key={value}
              onClick={() => push(currentSearch, value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700'
              )}
            >
              {label}
              <span className={cn('text-[10px] font-normal', isActive ? 'text-violet-200' : 'text-gray-400')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
