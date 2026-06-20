'use client'

/**
 * CommunityList — Card list kontak komunitas, client-side filter.
 * Tidak ada reload page saat search/filter.
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Users2, Plus, ChevronRight } from 'lucide-react'

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  poundfit: { label: 'Poundfit', color: 'bg-red-100 text-red-700'    },
  barre:    { label: 'Barre',    color: 'bg-pink-100 text-pink-700'  },
  zumba:    { label: 'Zumba',    color: 'bg-violet-100 text-violet-700' },
  yoga:     { label: 'Yoga',     color: 'bg-green-100 text-green-700' },
  pilates:  { label: 'Pilates',  color: 'bg-blue-100 text-blue-700'  },
  aerobic:  { label: 'Aerobic',  color: 'bg-orange-100 text-orange-700' },
  other:    { label: 'Lainnya',  color: 'bg-gray-100 text-gray-600'  },
}

const SOURCE_LABEL: Record<string, string> = {
  manual:   'Manual',
  wa_group: 'Grup WA',
  walkin:   'Walk-in',
  booking:  'Booking',
}

interface Contact {
  id:                  string
  name:                string | null
  phone:               string | null
  class_type:          string | null
  source:              string
  created_at:          string
  converted_member_id: string | null
}

interface TypeOption { value: string; label: string }

interface Props {
  contacts:       Contact[]
  availableTypes: TypeOption[]
  total:          number
}

export function CommunityList({ contacts, availableTypes, total }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return contacts.filter(c => {
      const matchType   = !typeFilter || c.class_type === typeFilter
      const matchSearch = !q ||
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      return matchType && matchSearch
    })
  }, [contacts, search, typeFilter])

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau nomor HP..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        />
      </div>

      {/* Filter pills */}
      {availableTypes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          <button
            onClick={() => setTypeFilter('')}
            className={`h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              !typeFilter
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Semua
          </button>
          {availableTypes.map(t => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(v => v === t.value ? '' : t.value)}
              className={`h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                typeFilter === t.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!filtered.length ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Users2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {search || typeFilter ? 'Tidak ada kontak yang cocok' : 'Belum ada kontak komunitas'}
          </p>
          {!search && !typeFilter && (
            <Link
              href="/community/new"
              className="inline-flex items-center gap-1.5 mt-4 h-9 px-4 bg-violet-600 text-white rounded-xl text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Tambah Kontak
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const badge = c.class_type ? TYPE_BADGE[c.class_type] : null
            const sourceLabel = SOURCE_LABEL[c.source] ?? c.source
            const isMember = !!c.converted_member_id

            return (
              <Link
                key={c.id}
                href={`/community/${c.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-violet-100 hover:shadow-sm transition-all"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <span className="text-violet-600 font-bold text-sm">
                    {(c.name ?? '?')[0].toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {c.name ?? '(tanpa nama)'}
                    </p>
                    {isMember && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold shrink-0">
                        Member
                      </span>
                    )}
                    {badge && !isMember && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {c.phone ?? 'No. HP tidak ada'} · {sourceLabel}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            )
          })}

          <p className="text-xs text-gray-400 text-right pt-1">
            {filtered.length} dari {total} kontak
          </p>
        </div>
      )}
    </div>
  )
}
