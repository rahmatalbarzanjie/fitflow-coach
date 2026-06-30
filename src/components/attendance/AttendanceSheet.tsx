'use client'

/**
 * AttendanceSheet — Halaman absensi kelas.
 *
 * Sumber peserta (3):
 * 1. Member aktif instruktur
 * 2. Booking kelas yang sudah dikonfirmasi
 * 3. Walk-in (tambah manual saat kelas berlangsung)
 *
 * Komunitas tidak dipakai sebagai sumber — mereka harus jadi member dulu.
 *
 * UX:
 * - List vertikal (bukan grid avatar)
 * - Bottom sheet sederhana untuk walk-in
 * - Sticky footer dengan tombol Simpan
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { invalidateDashboardCache } from '@/lib/invalidate-dashboard'
import { Loader2, CheckCircle2, Circle, UserPlus, X } from 'lucide-react'
import { formatDateShort, formatTime } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type Source = 'member' | 'booking' | 'walkin'
type AttendState = 'hadir' | 'none'

interface Participant {
  key: string
  source: Source
  memberId?: string
  name: string
  phone: string
  state: AttendState
  attendanceId?: string // kalau sudah ada di DB
}

interface Props {
  cls: {
    id: string; name: string; type: string
    start_time: string; end_time: string
    payment_mode: string; class_price: number
  }
  session: {
    id: string; session_date: string
    start_time: string; end_time: string
  }
  members: { id: string; name: string; phone: string }[]
  bookings: { id: string; registrant_name: string; registrant_phone: string; member_id: string | null }[]
  existingAttendance: {
    id: string; member_id: string | null; source: string
    registrant_name: string | null; registrant_phone: string | null
  }[]
}

// ─── Bottom Sheet — Tambah Walk-In ───────────────────────────────────────────

function WalkinSheet({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, phone: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Lock scroll saat sheet terbuka
    document.body.style.overflow = 'hidden'
    setTimeout(() => nameRef.current?.focus(), 100)
    return () => { document.body.style.overflow = '' }
  }, [])

  function submit() {
    if (!name.trim()) { setError('Nama wajib diisi'); return }
    onAdd(name.trim(), phone.trim())
    onClose()
  }

  const inp = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full rounded-t-2xl shadow-xl z-10 pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Tambah Walk-In</h3>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nama <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Nama peserta"
              className={inp}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nomor HP <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="08xxxxxxxxxx"
              type="tel"
              className={inp}
            />
          </div>
          <button
            onClick={submit}
            className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors mt-1"
          >
            Tambah ke Absensi
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Row peserta ─────────────────────────────────────────────────────────────

function ParticipantRow({
  name, phone, source, state, onTap,
}: {
  name: string
  phone: string
  source: Source
  state: AttendState
  onTap: () => void
}) {
  const hadir = state === 'hadir'

  const sourceBadge: Record<Source, { label: string; color: string }> = {
    member: { label: 'Member', color: 'bg-violet-100 text-violet-700' },
    booking: { label: 'Booking', color: 'bg-blue-100 text-blue-700' },
    walkin: { label: 'Walk-in', color: 'bg-orange-100 text-orange-700' },
  }

  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${hadir ? 'bg-green-50' : 'hover:bg-gray-50'
        }`}
    >
      {/* Centang */}
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${hadir ? 'text-green-500' : 'text-gray-300'
        }`}>
        {hadir
          ? <CheckCircle2 className="w-6 h-6" />
          : <Circle className="w-6 h-6" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${hadir ? 'text-green-800' : 'text-gray-900'}`}>
          {name}
        </p>
        {phone && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{phone}</p>
        )}
      </div>

      {/* Badge source */}
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${sourceBadge[source].color}`}>
        {sourceBadge[source].label}
      </span>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AttendanceSheet({
  cls, session, members, bookings, existingAttendance,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Bangun daftar peserta awal dari 2 sumber (member + booking)
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const list: Participant[] = []
    const addedMemberIds = new Set<string>()

    // 1. Member aktif
    for (const m of members) {
      const existing = existingAttendance.find(a => a.member_id === m.id)
      list.push({
        key: `member-${m.id}`,
        source: 'member',
        memberId: m.id,
        name: m.name,
        phone: m.phone ?? '',
        state: existing ? 'hadir' : 'none',
        attendanceId: existing?.id,
      })
      addedMemberIds.add(m.id)
    }

    // 2. Booking yang dikonfirmasi (skip kalau sudah masuk via member)
    for (const b of bookings) {
      if (b.member_id && addedMemberIds.has(b.member_id)) continue
      const existing = existingAttendance.find(a =>
        b.member_id ? a.member_id === b.member_id : false
      )
      list.push({
        key: `booking-${b.id}`,
        source: 'booking',
        memberId: b.member_id ?? undefined,
        name: b.registrant_name,
        phone: b.registrant_phone ?? '',
        state: existing ? 'hadir' : 'none',
        attendanceId: existing?.id,
      })
    }

    // 3. Walk-in yang sudah tersimpan
    for (const a of existingAttendance) {
      if (a.source !== 'walkin') continue
      list.push({
        key: `walkin-${a.id}`,
        source: 'walkin',
        name: a.registrant_name ?? 'Peserta',
        phone: a.registrant_phone ?? '',
        state: 'hadir',
        attendanceId: a.id,
      })
    }

    return list
  })

  const [showSheet, setShowSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hadirCount = useMemo(
    () => participants.filter(p => p.state === 'hadir').length,
    [participants]
  )

  function tap(key: string) {
    setParticipants(prev => prev.map(p =>
      p.key === key
        ? { ...p, state: p.state === 'hadir' ? 'none' : 'hadir' }
        : p
    ))
  }

  function addWalkin(name: string, phone: string) {
    const key = `walkin-new-${Date.now()}`
    setParticipants(prev => [...prev, {
      key, source: 'walkin', name, phone, state: 'hadir',
    }])
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const hadirList = participants.filter(p => p.state === 'hadir')
      const noneList = participants.filter(p => p.state === 'none')

      // Hapus attendance yang di-uncheck
      const toDelete = noneList
        .filter(p => p.attendanceId)
        .map(p => p.attendanceId!)
      if (toDelete.length > 0) {
        await supabase.from('attendance').delete().in('id', toDelete)
      }

      // Insert attendance baru
      const toInsert = hadirList
        .filter(p => !p.attendanceId)
        .map(p => ({
          session_id: session.id,
          user_id: undefined as any, // di-set via RLS/trigger
          member_id: p.source === 'member' ? p.memberId ?? null : null,
          source: p.source,
          payment_mode: cls.payment_mode ?? 'drop_in',
          amount_paid: cls.class_price ?? 0,
          registrant_name: p.source !== 'member' ? p.name : null,
          registrant_phone: p.source !== 'member' ? p.phone : null,
        }))

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('attendance')
          .insert(toInsert)
        if (insertErr) throw new Error(insertErr.message)
      }

      // Update session status
      await supabase.from('sessions').update({ status: 'completed' }).eq('id', session.id)

      // Absensi memengaruhi attendance_month/atRiskMembers di cache Beranda -
      // satu invalidasi di sini sudah cukup, candidate komunitas di bawah ikut
      // tag yang sama (sama-sama bagian dari getCachedBerandaData).
      invalidateDashboardCache()

      // Absensi sukses — tampilkan toast dulu
      setToast(`✓ ${hadirCount} orang hadir tersimpan`)

        // ── Generate invitation candidates (best-effort, tidak blok UI) ──────────
        // Dijalankan setelah absensi sukses tersimpan.
        // Kalau gagal: tidak error ke user, cukup silent.
        ; (async () => {
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            const userId = currentUser?.id
            if (!userId) return

            const eligibleForInvite = hadirList.filter(p =>
              p.phone.trim() &&
              p.source !== 'member'
            )
            if (!eligibleForInvite.length) return

            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

            // Cek yang sudah diundang dalam 30 hari — jangan override invited → pending
            const { data: recentInvites } = await (supabase
              .from('community_invitation_candidates') as any)
              .select('phone, class_type, status')
              .eq('user_id', userId)
              .eq('class_type', cls.type)
              .gte('invited_at', thirtyDaysAgo)

            // Key untuk skip: sudah invited dalam 30 hari
            const skipKeys = new Set(
              ((recentInvites ?? []) as any[])
                .filter((r: any) => r.status === 'invited')
                .map((r: any) => `${r.phone}-${r.class_type}`)
            )

            // Key yang sudah ada (pending/dismissed) — boleh di-upsert
            const existingKeys = new Set(
              ((recentInvites ?? []) as any[])
                .map((r: any) => `${r.phone}-${r.class_type}`)
            )

            const candidates = eligibleForInvite
              .filter(p => !skipKeys.has(`${p.phone}-${cls.type}`))
              .map(p => ({
                user_id: userId,
                name: p.name,
                phone: p.phone,
                class_type: cls.type,
                source_type: 'class_attendance',
                source_id: session.id,
                attendance_date: session.session_date,
                status: 'pending',
              }))

            if (candidates.length > 0) {
              await (supabase.from('community_invitation_candidates') as any)
                .upsert(candidates, {
                  onConflict: 'user_id,phone,class_type',
                  ignoreDuplicates: false,  // reset dismissed → pending
                })
            }
          } catch {
            // Silent fail — absensi sudah berhasil, kandidat bisa di-generate ulang absensi berikutnya
          }
        })()
      // ─────────────────────────────────────────────────────────────────────────

      setTimeout(() => {
        router.push(`/classes/${cls.id}`)
        router.refresh()
      }, 1800)
    } catch (e: any) {
      setError(e.message ?? 'Gagal menyimpan absensi')
    } finally {
      setSaving(false)
    }
  }

  // Split list
  const memberList = participants.filter(p => p.source === 'member')
  const bookingList = participants.filter(p => p.source === 'booking')
  const walkinList = participants.filter(p => p.source === 'walkin')
  const totalPeserta = memberList.length + bookingList.length

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="flex-1 pb-28">

        {/* Section: Peserta */}
        <div className="mb-4">
          {totalPeserta > 0 ? (
            <div className="bg-white border-y border-gray-100 divide-y divide-gray-50">
              <div className="px-4 py-2.5 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Peserta Terdaftar ({totalPeserta})
                </p>
              </div>
              {[...memberList, ...bookingList].map(p => (
                <ParticipantRow
                  key={p.key}
                  name={p.name}
                  phone={p.phone}
                  source={p.source}
                  state={p.state}
                  onTap={() => tap(p.key)}
                />
              ))}
            </div>
          ) : (
            <div className="mx-4 mt-2 bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-gray-600 mb-1">Belum ada peserta terdaftar</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Tambahkan peserta walk-in jika ada peserta yang datang langsung ke kelas hari ini.
              </p>
            </div>
          )}
        </div>

        {/* Section: Walk-In */}
        <div className="bg-white border-y border-gray-100">
          <div className="px-4 py-2.5 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Walk-In {walkinList.length > 0 ? `(${walkinList.length})` : ''}
            </p>
          </div>

          {walkinList.map(p => (
            <ParticipantRow
              key={p.key}
              name={p.name}
              phone={p.phone}
              source="walkin"
              state={p.state}
              onTap={() => tap(p.key)}
            />
          ))}

          {/* Tombol tambah walk-in */}
          <button
            onClick={() => setShowSheet(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-violet-600 hover:bg-violet-50 transition-colors"
          >
            <UserPlus className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">Tambah Walk-In</span>
          </button>
        </div>
      </div>

      {/* ── STICKY FOOTER ── */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-60 z-20 bg-white border-t border-gray-100 px-4 py-3 pb-safe md:pb-3 flex justify-center">
        <button
          onClick={handleSave}
          disabled={saving || !!toast}
          className="w-full md:w-auto md:min-w-[280px] h-13 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm py-3.5 px-6"
        >
          {saving
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</>
            : toast
              ? <><span className="text-base">✓</span> {toast}</>
              : `Simpan Absensi · ${hadirCount} hadir`
          }
        </button>
      </div>

      {/* ── Bottom Sheet Walk-In ── */}
      {showSheet && (
        <WalkinSheet
          onAdd={addWalkin}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  )
}
