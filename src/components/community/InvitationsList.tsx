'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateShort } from '@/lib/utils'
import {
  MessageSquare, CheckCircle2,
  AlertTriangle, Users, Loader2, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

const CLASS_TYPE_LABEL: Record<string, string> = {
  barre: 'Barre', poundfit: 'Poundfit', yoga: 'Yoga',
  pilates: 'Pilates', zumba: 'Zumba', aerobic: 'Aerobic', other: 'Kelas',
}

const STATUS_TABS = [
  { key: 'pending', label: 'Menunggu'      },
  { key: 'invited', label: 'Sudah Diundang'},
]

interface Candidate {
  id:              string
  name:            string
  phone:           string
  class_type:      string
  status:          string
  attendance_date: string
  invited_at:      string | null
}

interface Props {
  candidates:       Candidate[]
  linkAvailableMap: Record<string, boolean>
}

export function InvitationsList({ candidates, linkAvailableMap }: Props) {
  const router   = useRouter()
  const [tab,        setTab      ] = useState('pending')
  const [sending,    setSending  ] = useState<Set<string>>(new Set())
  const [sendingAll, setSendingAll] = useState(false)
  const [results,    setResults  ] = useState<Record<string, 'success' | 'error'>>({})

  const filtered = useMemo(() =>
    candidates.filter(c => c.status === tab)
  , [candidates, tab])

  const pendingCount = candidates.filter(c => c.status === 'pending').length

  async function sendInvite(ids: string[]) {
    setSending(prev => new Set([...prev, ...ids]))
    try {
      const res  = await fetch('/api/community/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ candidateIds: ids }),
      })
      const data = await res.json()

      // Update local result state
      const newResults: Record<string, 'success' | 'error'> = {}
      for (const r of data.results ?? []) {
        newResults[r.id] = r.success ? 'success' : 'error'
      }
      setResults(prev => ({ ...prev, ...newResults }))

      // Refresh data setelah semua terkirim
      setTimeout(() => router.refresh(), 1500)
    } catch {
      ids.forEach(id => setResults(prev => ({ ...prev, [id]: 'error' })))
    } finally {
      setSending(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
      setSendingAll(false)
    }
  }

  async function sendAll() {
    const pendingIds = filtered
      .filter(c => linkAvailableMap[c.class_type] && !results[c.id])
      .map(c => c.id)
    if (!pendingIds.length) return
    setSendingAll(true)
    await sendInvite(pendingIds)
  }

  // Cek apakah semua pending punya link
  const allHaveLink = filtered.every(c => linkAvailableMap[c.class_type])

  return (
    <div>
      {/* Setup warning jika ada class_type tanpa link */}
      {!allHaveLink && tab === 'pending' && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-700">Link grup WA belum diisi</p>
            <p className="text-xs text-orange-600 mt-0.5">
              Beberapa kelas belum memiliki link undangan komunitas.
            </p>
          </div>
          <Link href="/community/setup"
            className="text-xs font-semibold text-orange-700 hover:underline shrink-0 flex items-center gap-1">
            Setup <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Tab filter */}
      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`h-8 px-4 rounded-full text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}

        {/* Undang Semua */}
        {tab === 'pending' && filtered.length > 1 && (
          <button
            onClick={sendAll}
            disabled={sendingAll || !allHaveLink}
            className="ml-auto h-8 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {sendingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {sendingAll ? 'Mengirim...' : `Undang Semua (${filtered.length})`}
          </button>
        )}
      </div>

      {/* Empty state */}
      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600 mb-1">
            {tab === 'pending' ? 'Tidak ada kandidat undangan' : 'Belum ada yang diundang'}
          </p>
          <p className="text-xs text-gray-400">
            {tab === 'pending'
              ? 'Kandidat muncul otomatis setelah kamu menyimpan absensi kelas.'
              : 'Kirim undangan ke peserta dari tab Menunggu.'}
          </p>
        </div>
      ) : (
        // Group per class_type agar instruktur tahu link mana yang dipakai
        (() => {
          const groups = filtered.reduce<Record<string, typeof filtered>>((acc, c) => {
            if (!acc[c.class_type]) acc[c.class_type] = []
            acc[c.class_type].push(c)
            return acc
          }, {})

          return (
            <div className="space-y-4">
              {Object.entries(groups).map(([classType, items]) => {
                const hasLink     = linkAvailableMap[classType] ?? false
                const typeLabel   = CLASS_TYPE_LABEL[classType] ?? classType
                const typeColor   = classType === 'barre'
                  ? 'text-pink-600 bg-pink-50 border-pink-100'
                  : classType === 'poundfit'
                  ? 'text-red-600 bg-red-50 border-red-100'
                  : classType === 'yoga'
                  ? 'text-green-600 bg-green-50 border-green-100'
                  : 'text-violet-600 bg-violet-50 border-violet-100'

                return (
                  <div key={classType}>
                    {/* Section header per class_type */}
                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border mb-2 ${typeColor}`}>
                      <p className="text-xs font-bold uppercase tracking-wide">
                        {typeLabel} ({items.length})
                      </p>
                      {!hasLink && (
                        <Link href="/community/setup" className="text-[10px] font-semibold hover:underline">
                          Setup link →
                        </Link>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                      {items.map(c => {
                        const isSending   = sending.has(c.id)
                        const result      = results[c.id]
                        const alreadyDone = result === 'success' || c.status === 'invited'

                        return (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                              <span className="text-violet-600 font-bold text-sm">
                                {c.name[0].toUpperCase()}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {c.phone}
                                <span className="mx-1.5">·</span>
                                {formatDateShort(c.attendance_date)}
                                {c.status === 'invited' && c.invited_at && (
                                  <span className="ml-1.5 text-green-600">
                                    · Diundang {formatDateShort(c.invited_at)}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Status / Aksi */}
                            <div className="shrink-0">
                              {alreadyDone ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="text-xs font-medium">Terkirim</span>
                                </div>
                              ) : result === 'error' ? (
                                <div className="text-right">
                                  <p className="text-xs text-red-500 font-medium">Gagal kirim</p>
                                  <button
                                    onClick={() => sendInvite([c.id])}
                                    className="text-[10px] text-red-400 hover:underline"
                                  >
                                    Coba lagi
                                  </button>
                                </div>
                              ) : !hasLink ? (
                                <div className="text-right">
                                  <p className="text-xs text-orange-500 font-medium">Link belum diisi</p>
                                  <Link href="/community/setup" className="text-[10px] text-orange-400 hover:underline">
                                    Setup komunitas →
                                  </Link>
                                </div>
                              ) : (
                                <button
                                  onClick={() => sendInvite([c.id])}
                                  disabled={isSending}
                                  className="flex items-center gap-1.5 h-8 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
                                >
                                  {isSending
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <MessageSquare className="w-3.5 h-3.5" />
                                  }
                                  {isSending ? 'Kirim...' : 'Undang'}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()
      )}
    </div>
  )
}
