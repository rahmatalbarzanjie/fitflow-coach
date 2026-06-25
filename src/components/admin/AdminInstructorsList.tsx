'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Users } from 'lucide-react'
import { MessageCircle } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { TrialManager } from '@/components/admin/TrialManager'

const STATUS_TABS = [
  { value: 'all',     label: 'Semua'   },
  { value: 'active',  label: 'Aktif'   },
  { value: 'trial',   label: 'Trial'   },
  { value: 'expired', label: 'Habis'   },
  { value: 'no_bot',  label: 'Bot WA belum setup' },
]

interface Profile {
  id: string
  name: string | null
  business_name: string | null
  slug: string | null
  phone: string | null
  created_at: string | null
  trial_expires_at: string | null
  subscription_status: string | null
  fonnte_token: string | null
  bot_phone: string | null
}

interface Props {
  profiles: Profile[]
}

export function AdminInstructorsList({ profiles }: Props) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const now = new Date()

  const enriched = useMemo(() => profiles.map(p => {
    const trialExpired = !!(p.trial_expires_at && new Date(p.trial_expires_at) < now)
    const trialDaysLeft = p.trial_expires_at
      ? Math.max(0, Math.ceil((new Date(p.trial_expires_at).getTime() - now.getTime()) / 86_400_000))
      : null
    const subStatus = p.subscription_status ?? 'trial'
    const botConnected = !!(p.fonnte_token && String(p.fonnte_token).trim().length > 10 && p.bot_phone)
    return { ...p, trialExpired, trialDaysLeft, subStatus, botConnected }
  }), [profiles, now])

  const counts = useMemo(() => ({
    active:  enriched.filter(p => p.subStatus === 'active').length,
    trial:   enriched.filter(p => p.subStatus !== 'active' && !p.trialExpired).length,
    expired: enriched.filter(p => p.trialExpired).length,
    no_bot:  enriched.filter(p => !p.botConnected).length,
  }), [enriched])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return enriched.filter(p => {
      const matchStatus =
        status === 'all' ? true :
        status === 'active' ? p.subStatus === 'active' :
        status === 'trial' ? p.subStatus !== 'active' && !p.trialExpired :
        status === 'expired' ? p.trialExpired :
        status === 'no_bot' ? !p.botConnected : true
      const name = (p.business_name ?? p.name ?? '').toLowerCase()
      const matchSearch = !q || name.includes(q) || (p.phone ?? '').includes(q) || (p.slug ?? '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [enriched, search, status])

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, nomor HP, atau slug..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {STATUS_TABS.map(tab => {
          const count = tab.value === 'all' ? profiles.length : (counts[tab.value as keyof typeof counts] ?? 0)
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
              <span className={`text-[10px] font-bold ${status === tab.value ? 'text-violet-200' : 'text-gray-400'}`}>
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
            {search || status !== 'all' ? 'Tidak ada instruktur yang cocok' : 'Belum ada instruktur terdaftar'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="flex items-start justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{p.business_name ?? p.name}</p>
                  {p.slug && <span className="text-xs text-gray-400 font-mono">/{p.slug}</span>}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    p.subStatus === 'active' ? 'bg-green-100 text-green-700' :
                    p.trialExpired           ? 'bg-red-100 text-red-600'    :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {p.subStatus === 'active' ? 'Aktif' : p.trialExpired ? 'Habis' : `Trial${p.trialDaysLeft !== null ? ` · ${p.trialDaysLeft}h` : ''}`}
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    p.botConnected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <MessageCircle className="w-2.5 h-2.5" />
                    {p.botConnected ? 'Bot WA ✓' : 'Bot WA belum setup'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{p.phone ?? '-'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Daftar: {formatDateShort(p.created_at ?? new Date().toISOString())}
                  {p.trial_expires_at && ` · Trial s/d ${formatDateShort(p.trial_expires_at)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Link href={`/admin/${p.id}`} className="text-xs text-gray-400 hover:text-violet-600 transition-colors">
                  Detail →
                </Link>
                <TrialManager profileId={p.id} currentStatus={p.subStatus} trialExpiresAt={p.trial_expires_at} />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 text-right pt-1">
            {filtered.length} dari {profiles.length} instruktur
          </p>
        </div>
      )}
    </div>
  )
}
