'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Users, ArrowUpDown } from 'lucide-react'
import { MessageCircle } from 'lucide-react'
import { formatDateShort, timeAgo } from '@/lib/utils'
import { TrialManager } from '@/components/admin/TrialManager'

const STATUS_TABS = [
  { value: 'all',     label: 'Semua'   },
  { value: 'active',  label: 'Aktif'   },
  { value: 'trial',   label: 'Trial'   },
  { value: 'expired', label: 'Habis'   },
  { value: 'no_bot',  label: 'Bot WA belum setup' },
]

// Satu state untuk dua "mode" (Tahap pra-Aktivasi / Kesehatan pasca-Aktivasi).
// Disengaja jadi SATU daftar, bukan dua state terpisah - memilih satu opsi
// otomatis tidak mungkin bentrok dengan opsi dari mode lain, karena memang
// cuma ada satu nilai terpilih pada satu waktu. Ini menjamin "saling
// eksklusif" secara struktur, bukan lewat logika reset manual yang gampang
// lupa ditulis ulang nanti.
const FUNNEL_HEALTH_TABS = [
  { value: 'stage:setup',           label: 'Setup',           group: 'stage' as const },
  { value: 'stage:go_live',         label: 'Go-Live',         group: 'stage' as const },
  { value: 'stage:first_traction',  label: 'First Traction',  group: 'stage' as const },
  { value: 'health:healthy',        label: 'Healthy',         group: 'health' as const },
  { value: 'health:needs_attention',label: 'Needs Attention', group: 'health' as const },
  { value: 'health:at_risk',        label: 'At Risk',         group: 'health' as const },
  { value: 'health:inactive',       label: 'Inactive',        group: 'health' as const },
]

type SortMode = 'newest' | 'stale'

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
  // Sprint 2 - hasil gabungan instructor_funnel_status / instructor_health_tier (migrasi 079)
  stage: 'signup' | 'setup' | 'go_live' | 'first_traction' | 'activated'
  is_activated: boolean
  health_tier: 'healthy' | 'needs_attention' | 'at_risk' | 'inactive' | null
  last_operational_activity_at: string | null
}

interface Props {
  profiles: Profile[]
}

// Satu titik keputusan badge Status - menjamin Stage dan Health TIDAK PERNAH
// tampil bersamaan untuk instruktur yang sama (aturan serah-terima funnel<->health
// yang sudah dikunci di docs/PLATFORM_ADMIN_V1_FINAL_DESIGN.md).
function resolveStatusBadge(p: Profile): { label: string; className: string } {
  if (p.is_activated) {
    switch (p.health_tier) {
      case 'healthy':         return { label: 'Healthy',         className: 'bg-green-100 text-green-700' }
      case 'needs_attention': return { label: 'Needs Attention', className: 'bg-amber-100 text-amber-700' }
      case 'at_risk':         return { label: 'At Risk',         className: 'bg-orange-100 text-orange-700' }
      case 'inactive':        return { label: 'Inactive',        className: 'bg-gray-200 text-gray-600' }
      default:                return { label: 'Activated',       className: 'bg-violet-100 text-violet-700' }
    }
  }
  switch (p.stage) {
    case 'setup':          return { label: 'Setup',          className: 'bg-blue-100 text-blue-600' }
    case 'go_live':        return { label: 'Go-Live',        className: 'bg-indigo-100 text-indigo-600' }
    case 'first_traction': return { label: 'First Traction', className: 'bg-sky-100 text-sky-600' }
    default:                return { label: 'Signup',         className: 'bg-gray-100 text-gray-500' }
  }
}

export function AdminInstructorsList({ profiles }: Props) {
  const [search, setSearch]                 = useState('')
  const [status, setStatus]                 = useState('all')
  const [funnelHealthFilter, setFunnelHealthFilter] = useState('all')
  const [sortMode, setSortMode]             = useState<SortMode>('newest')
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

  const funnelHealthCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tab of FUNNEL_HEALTH_TABS) {
      const [group, value] = tab.value.split(':')
      map[tab.value] = enriched.filter(p =>
        group === 'stage'  ? (!p.is_activated && p.stage === value) :
        group === 'health' ? (p.is_activated && p.health_tier === value) : false
      ).length
    }
    return map
  }, [enriched])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = enriched.filter(p => {
      const matchStatus =
        status === 'all' ? true :
        status === 'active' ? p.subStatus === 'active' :
        status === 'trial' ? p.subStatus !== 'active' && !p.trialExpired :
        status === 'expired' ? p.trialExpired :
        status === 'no_bot' ? !p.botConnected : true
      const matchFunnelHealth =
        funnelHealthFilter === 'all' ? true :
        (() => {
          const [group, value] = funnelHealthFilter.split(':')
          return group === 'stage'  ? (!p.is_activated && p.stage === value) :
                 group === 'health' ? (p.is_activated && p.health_tier === value) : true
        })()
      const name = (p.business_name ?? p.name ?? '').toLowerCase()
      const matchSearch = !q || name.includes(q) || (p.phone ?? '').includes(q) || (p.slug ?? '').toLowerCase().includes(q)
      return matchStatus && matchFunnelHealth && matchSearch
    })

    if (sortMode === 'stale') {
      // Belum pernah ada aktivitas (NULL) ditaruh paling atas - diperlakukan
      // sebagai "paling butuh perhatian", bukan diabaikan ke bawah.
      return [...base].sort((a, b) => {
        const at = a.last_operational_activity_at ? new Date(a.last_operational_activity_at).getTime() : -Infinity
        const bt = b.last_operational_activity_at ? new Date(b.last_operational_activity_at).getTime() : -Infinity
        return at - bt
      })
    }
    return base // default: urutan dari server sudah created_at desc, tidak perlu re-sort
  }, [enriched, search, status, funnelHealthFilter, sortMode])

  const hasActiveFilter = !!search || status !== 'all' || funnelHealthFilter !== 'all'

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
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
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

      {/* Tahap & Kesehatan - SATU filter dengan dua mode visual, bukan dua
          filter independen. "Semua" mereset ke luar kedua mode sekaligus. */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Tahap &amp; Kesehatan
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFunnelHealthFilter('all')}
            className={`h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              funnelHealthFilter === 'all'
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Semua
          </button>

          <span className="text-[10px] text-gray-300 font-medium px-0.5">Tahap</span>
          {FUNNEL_HEALTH_TABS.filter(t => t.group === 'stage').map(tab => {
            const count = funnelHealthCounts[tab.value] ?? 0
            if (count === 0) return null
            return (
              <button
                key={tab.value}
                onClick={() => setFunnelHealthFilter(tab.value)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  funnelHealthFilter === tab.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] font-bold ${funnelHealthFilter === tab.value ? 'text-indigo-200' : 'text-indigo-400'}`}>
                  {count}
                </span>
              </button>
            )
          })}

          <span className="text-[10px] text-gray-300 font-medium px-0.5 ml-1">Kesehatan</span>
          {FUNNEL_HEALTH_TABS.filter(t => t.group === 'health').map(tab => {
            const count = funnelHealthCounts[tab.value] ?? 0
            if (count === 0) return null
            return (
              <button
                key={tab.value}
                onClick={() => setFunnelHealthFilter(tab.value)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  funnelHealthFilter === tab.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] font-bold ${funnelHealthFilter === tab.value ? 'text-emerald-200' : 'text-emerald-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sort toggle - default tetap Terbaru Daftar, operator bisa pindah manual */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />
        <button
          onClick={() => setSortMode('newest')}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            sortMode === 'newest' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Terbaru Daftar
        </button>
        <button
          onClick={() => setSortMode('stale')}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            sortMode === 'stale' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Aktivitas Terlama
        </button>
      </div>

      {/* List */}
      {!filtered.length ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {hasActiveFilter ? 'Tidak ada instruktur yang cocok' : 'Belum ada instruktur terdaftar'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const badge = resolveStatusBadge(p)
            return (
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
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                      {badge.label}
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
                    {p.last_operational_activity_at && ` · Aktivitas terakhir: ${timeAgo(p.last_operational_activity_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Link href={`/admin/${p.id}`} className="text-xs text-gray-400 hover:text-violet-600 transition-colors">
                    Detail →
                  </Link>
                  <TrialManager profileId={p.id} currentStatus={p.subStatus} trialExpiresAt={p.trial_expires_at} />
                </div>
              </div>
            )
          })}
          <p className="text-xs text-gray-400 text-right pt-1">
            {filtered.length} dari {profiles.length} instruktur
          </p>
        </div>
      )}
    </div>
  )
}
