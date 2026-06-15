'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateShort, formatTime } from '@/lib/utils'

type AttendState = 'none' | 'hadir' | 'tidak_hadir'

interface Member {
  id: string
  name: string
  phone: string
  status: string | null
  photo_url?: string | null
}

interface AttendanceRecord {
  id: string
  member_id: string
  payment_mode: string
  amount_paid: number | string
}

interface Session {
  id: string
  session_date: string
  start_time: string
  end_time: string
  user_id: string
}

interface ClassInfo {
  id: string
  name: string
  pricing_mode?: string | null
  class_price?: number | null
}

interface Props {
  cls: ClassInfo
  session: Session
  members: Member[]
  existingAttendance: AttendanceRecord[]
}

function MemberPhoto({ photoUrl, name }: { photoUrl?: string | null; name: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} className="w-full h-full object-cover rounded-full" />
  }
  return (
    <div className="w-full h-full rounded-full bg-violet-100 flex items-center justify-center">
      <span className="text-violet-600 font-semibold text-lg leading-none">{initials}</span>
    </div>
  )
}

function cycleState(current: AttendState): AttendState {
  if (current === 'none')          return 'hadir'
  if (current === 'hadir')         return 'tidak_hadir'
  return 'none'
}

export function AttendanceSheet({ cls, session, members, existingAttendance }: Props) {
  const router  = useRouter()
  const supabase = createClient()

  const [states, setStates] = useState<Record<string, AttendState>>(() => {
    const init: Record<string, AttendState> = {}
    for (const m of members) {
      const hasRecord = existingAttendance.some(a => a.member_id === m.id)
      init[m.id] = hasRecord ? 'hadir' : 'none'
    }
    return init
  })

  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const hadirCount = useMemo(
    () => Object.values(states).filter(s => s === 'hadir').length,
    [states]
  )

  function tap(memberId: string) {
    setStates(prev => ({ ...prev, [memberId]: cycleState(prev[memberId]) }))
    setError(null)
  }

  // Determine default payment based on class pricing
  function getPayment() {
    const mode = cls.pricing_mode
    if (mode === 'free')     return { payment_mode: 'free' as const, payment_method: null, amount_paid: 0 }
    if (mode === 'transfer') return { payment_mode: 'drop_in' as const, payment_method: 'transfer' as const, amount_paid: cls.class_price ?? 0 }
    return { payment_mode: 'drop_in' as const, payment_method: 'cash' as const, amount_paid: cls.class_price ?? 0 }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const hadirIds       = members.filter(m => states[m.id] === 'hadir').map(m => m.id)
    const notHadirIds    = members.filter(m => states[m.id] !== 'hadir').map(m => m.id)
    const existingIds    = existingAttendance.map(a => a.member_id)
    const toDelete       = notHadirIds.filter(id => existingIds.includes(id))

    const { payment_mode, payment_method, amount_paid } = getPayment()

    if (hadirIds.length > 0) {
      const toUpsert = hadirIds.map(id => ({
        session_id:     session.id,
        member_id:      id,
        user_id:        session.user_id,
        payment_mode,
        payment_method,
        amount_paid,
      }))
      const { error: err } = await supabase
        .from('attendance')
        .upsert(toUpsert, { onConflict: 'session_id,member_id' })
      if (err) {
        setError('Ups, ada yang salah. Coba lagi ya 🙏')
        setSaving(false)
        return
      }
    }

    if (toDelete.length > 0) {
      await supabase
        .from('attendance')
        .delete()
        .eq('session_id', session.id)
        .in('member_id', toDelete)
    }

    setSaving(false)
    setToast(`Absensi tersimpan! ${hadirCount} orang hadir ✓`)
    setTimeout(() => {
      router.push(`/classes/${cls.id}`)
      router.refresh()
    }, 3000)
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-12 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">{cls.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateShort(session.session_date)} · {formatTime(session.start_time)}–{formatTime(session.end_time)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600">{hadirCount}</p>
            <p className="text-xs text-gray-400">hadir</p>
          </div>
        </div>
        {error && (
          <div className="mt-2 p-2.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* ── PHOTO GRID ── */}
      <div className="flex-1 p-4 pb-24">
        {members.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Belum ada member terdaftar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {members.map(m => {
              const state = states[m.id]
              return (
                <button
                  key={m.id}
                  onClick={() => tap(m.id)}
                  className="flex flex-col items-center gap-2 outline-none focus:outline-none"
                >
                  {/* Photo circle */}
                  <div className={`relative w-24 h-24 rounded-full transition-all ${
                    state === 'hadir'
                      ? 'ring-4 ring-green-400 ring-offset-2'
                      : state === 'tidak_hadir'
                      ? 'ring-4 ring-red-400 ring-offset-2'
                      : 'ring-2 ring-gray-200'
                  }`}>
                    <MemberPhoto photoUrl={m.photo_url} name={m.name} />
                    {/* State overlay */}
                    {state !== 'none' && (
                      <div className={`absolute inset-0 rounded-full flex items-center justify-center bg-opacity-30 ${
                        state === 'hadir' ? 'bg-green-400/30' : 'bg-red-400/30'
                      }`}>
                        <span className={`text-3xl font-bold drop-shadow ${
                          state === 'hadir' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {state === 'hadir' ? '✓' : '✗'}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Name */}
                  <p className={`text-xs text-center font-medium leading-tight max-w-[96px] ${
                    state === 'hadir'
                      ? 'text-green-700'
                      : state === 'tidak_hadir'
                      ? 'text-red-500 line-through'
                      : 'text-gray-500'
                  }`}>
                    {m.name.split(' ')[0]}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── STICKY FOOTER ── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 z-20 bg-white border-t border-gray-100 p-3 pb-safe">
        <button
          onClick={handleSave}
          disabled={saving || !!toast}
          className="w-full h-14 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-2xl text-base font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {saving
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</>
            : toast
            ? <span className="text-sm">{toast}</span>
            : `Simpan Absensi (${hadirCount} hadir)`
          }
        </button>
      </div>
    </div>
  )
}
