'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Users } from 'lucide-react'
import { MemberAvatar } from '@/components/members/MemberPhotoUpload'
import { MemberStatusBadge } from '@/components/members/MemberStatusBadge'
import { timeAgo } from '@/lib/utils'

const STATUS_TABS = [
  { value: 'all',      label: 'Semua'           },
  { value: 'active',   label: 'Aktif'           },
  { value: 'new',      label: 'Baru'            },
  { value: 'at_risk',  label: 'Follow Up'       },
  { value: 'inactive', label: 'Tidak Aktif'     },
]

interface Member {
  id: string
  name: string
  phone: string
  status: string
  last_attended_at: string | null
  photo_url?: string | null
}

interface Props {
  members: Member[]
  counts: Record<string, number>
  total: number
}

export function MembersSearch({ members, counts, total }: Props) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  // Data selalu dari props (server) — filter hanya di client
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return members.filter(m => {
      const matchStatus = status === 'all' || m.status === status
      const matchSearch = !q || m.name.toLowerCase().includes(q) || m.phone.includes(q)
      return matchStatus && matchSearch
    })
  }, [members, search, status])

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau nomor HP..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {STATUS_TABS.map(tab => {
          const count = tab.value === 'all' ? total : (counts[tab.value] ?? 0)
          if (tab.value !== 'all' && count === 0) return null
          return (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                status === tab.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-bold ${
                status === tab.value ? 'text-violet-200' : 'text-gray-400'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {!filtered.length ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {search || status !== 'all' ? 'Tidak ada member yang cocok' : 'Belum ada member'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <Link
              key={m.id}
              href={`/members/${m.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-violet-100 hover:shadow-sm transition-all"
            >
              <MemberAvatar photoUrl={m.photo_url} name={m.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                  <MemberStatusBadge status={m.status} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{m.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">
                  {m.last_attended_at ? timeAgo(m.last_attended_at) : 'Belum pernah'}
                </p>
              </div>
            </Link>
          ))}
          <p className="text-xs text-gray-400 text-right pt-1">
            {filtered.length} dari {total} member
          </p>
        </div>
      )}
    </div>
  )
}
