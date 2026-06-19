'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateShort, formatTime } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type AttendState = 'none' | 'hadir' | 'tidak_hadir'
type ParticipantSource = 'member' | 'booking' | 'walkin'

interface Member {
  id: string
  name: string
  phone: string
  status: string | null
  photo_url?: string | null
}

interface CommunityContact {
  id: string
  name: string | null
  phone: string | null
  class_type: string | null
  source: string
}

interface Booking {
  id: string
  registrant_name: string
  registrant_phone: string
  member_id: string | null
  community_id: string | null
}

interface AttendanceRecord {
  id: string
  member_id: string | null
  community_id: string | null
  source: string
  payment_mode: string
  payment_method: string | null
  amount_paid: number | string
  registrant_name?: string | null
  registrant_phone?: string | null
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
  type: string
  payment_mode?: string | null
  class_price?: number | null
}

interface Props {
  cls: ClassInfo
  session: Session
  members: Member[]
  communityContacts: CommunityContact[]
  bookings: Booking[]
  existingAttendance: AttendanceRecord[]
}

// Key unik per participant
function participantKey(source: ParticipantSource, id: string) {
  return `${source}::${id}`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
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

function ParticipantCard({
  name,
  photoUrl,
  badge,
  state,
  onTap,
}: {
  name: string
  photoUrl?: string | null
  badge?: 'member' | 'booking' | 'walkin'
  state: AttendState
  onTap: () => void
}) {
  const badgeLabel: Record<string, string> = {
    member:  'Member',
    booking: 'Booking',
    walkin:  'Walk-in',
  }
  const badgeColor: Record<string, string> = {
    member:  'bg-violet-100 text-violet-600',
    booking: 'bg-blue-100 text-blue-600',
    walkin:  'bg-orange-100 text-orange-600',
  }

  return (
    <button onClick={onTap} className="flex flex-col items-center gap-2 outline-none">
      <div className={`relative w-20 h-20 rounded-full transition-all ${
        state === 'hadir'
          ? 'ring-4 ring-green-400 ring-offset-2'
          : state === 'tidak_hadir'
          ? 'ring-4 ring-red-400 ring-offset-2'
          : 'ring-2 ring-gray-200'
      }`}>
        <Avatar name={name} photoUrl={photoUrl} />
        {state !== 'none' && (
          <div className={`absolute inset-0 rounded-full flex items-center justify-center ${
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
      <div className="flex flex-col items-center gap-1">
        <p className={`text-xs text-center font-medium leading-tight max-w-[80px] ${
          state === 'hadir' ? 'text-green-700'
          : state === 'tidak_hadir' ? 'text-red-500 line-through'
          : 'text-gray-600'
        }`}>
          {name.split(' ')[0]}
        </p>
        {badge && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badgeColor[badge]}`}>
            {badgeLabel[badge]}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Walk-in Modal ────────────────────────────────────────────────────────────

function WalkinModal({
  communityContacts,
  existingKeys,
  onAdd,
  onClose,
}: {
  communityContacts: CommunityContact[]
  existingKeys: Set<string>
  onAdd: (participant: { type: 'community'; data: CommunityContact } | { type: 'new'; name: string; phone: string }) => void
  onClose: () => void
}) {
  const [search, setSearch]   = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [tab, setTab]         = useState<'search' | 'new'>('search')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return communityContacts.filter(c => {
      const key = participantKey('booking', c.id)
      if (existingKeys.has(key)) return false
      return (
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      )
    })
  }, [search, communityContacts, existingKeys])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Tambah Peserta</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('search')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'search' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Cari Komunitas
          </button>
          <button
            onClick={() => setTab('new')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'new' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Peserta Baru
          </button>
        </div>

        {tab === 'search' ? (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama atau nomor HP..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {search ? 'Tidak ditemukan' : 'Semua kontak komunitas sudah ada di daftar'}
                </p>
              ) : (
                filtered.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onAdd({ type: 'community', data: c }); onClose() }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-semibold text-sm">
                        {(c.name ?? '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name ?? '-'}</p>
                      <p className="text-xs text-gray-400">{c.phone ?? '-'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nama peserta *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              autoFocus
            />
            <input
              type="tel"
              placeholder="Nomor HP (opsional)"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <button
              onClick={() => {
                if (!newName.trim()) return
                onAdd({ type: 'new', name: newName.trim(), phone: newPhone.trim() })
                onClose()
              }}
              disabled={!newName.trim()}
              className="w-full py-3 bg-violet-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold"
            >
              Tambahkan ke Absensi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AttendanceSheet({
  cls,
  session,
  members,
  communityContacts,
  bookings,
  existingAttendance,
}: Props) {
  const router   = useRouter()
  const supabase = createClient()

  // Bangun daftar participant awal dari 3 sumber
  type ParticipantEntry = {
    key: string
    source: ParticipantSource
    memberId?: string
    communityId?: string
    name: string
    phone: string
    photoUrl?: string | null
    state: AttendState
  }

  const [participants, setParticipants] = useState<ParticipantEntry[]>(() => {
    const list: ParticipantEntry[] = []
    const addedMemberIds    = new Set<string>()
    const addedCommunityIds = new Set<string>()

    // 1. Members aktif
    for (const m of members) {
      const hasRecord = existingAttendance.some(a => a.member_id === m.id)
      list.push({
        key:      participantKey('member', m.id),
        source:   'member',
        memberId: m.id,
        name:     m.name,
        phone:    m.phone,
        photoUrl: m.photo_url,
        state:    hasRecord ? 'hadir' : 'none',
      })
      addedMemberIds.add(m.id)
    }

    // 2. Booking yang sudah dikonfirmasi (dari registrations)
    for (const b of bookings) {
      // Skip kalau sudah masuk via member
      if (b.member_id && addedMemberIds.has(b.member_id)) continue
      if (b.community_id && addedCommunityIds.has(b.community_id)) continue

      const hasRecord = existingAttendance.some(a =>
        (b.community_id && a.community_id === b.community_id) ||
        (b.member_id && a.member_id === b.member_id)
      )
      const key = b.community_id
        ? participantKey('booking', b.community_id)
        : participantKey('booking', b.id)

      list.push({
        key,
        source:      'booking',
        communityId: b.community_id ?? undefined,
        memberId:    b.member_id ?? undefined,
        name:        b.registrant_name,
        phone:       b.registrant_phone,
        state:       hasRecord ? 'hadir' : 'none',
      })
      if (b.community_id) addedCommunityIds.add(b.community_id)
    }

    // 3. Walk-in yang sudah tercatat di attendance (source=walkin)
    for (const a of existingAttendance) {
      if (a.source !== 'walkin') continue
      const key = participantKey('walkin', a.id)
      list.push({
        key,
        source: 'walkin',
        name:   a.registrant_name ?? 'Peserta',
        phone:  a.registrant_phone ?? '',
        state:  'hadir',
      })
    }

    return list
  })

  const [showWalkin, setShowWalkin] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const hadirCount = useMemo(
    () => participants.filter(p => p.state === 'hadir').length,
    [participants]
  )

  const existingKeys = useMemo(
    () => new Set(participants.map(p => p.key)),
    [participants]
  )

  function tap(key: string) {
    setParticipants(prev => prev.map(p =>
      p.key !== key ? p : {
        ...p,
        state: p.state === 'none' ? 'hadir'
             : p.state === 'hadir' ? 'tidak_hadir'
             : 'none',
      }
    ))
    setError(null)
  }

  function addWalkin(participant: { type: 'community'; data: CommunityContact } | { type: 'new'; name: string; phone: string }) {
    if (participant.type === 'community') {
      const c = participant.data
      const key = participantKey('booking', c.id)
      if (existingKeys.has(key)) return
      setParticipants(prev => [...prev, {
        key,
        source:      'booking',
        communityId: c.id,
        name:        c.name ?? 'Peserta',
        phone:       c.phone ?? '',
        state:       'hadir',
      }])
    } else {
      const key = participantKey('walkin', `new-${Date.now()}`)
      setParticipants(prev => [...prev, {
        key,
        source: 'walkin',
        name:   participant.name,
        phone:  participant.phone,
        state:  'hadir',
      }])
    }
  }

  function getPayment() {
    const mode = cls.payment_mode
    if (mode === 'free')     return { payment_mode: 'free' as const, payment_method: null, amount_paid: 0 }
    if (mode === 'transfer') return { payment_mode: 'drop_in' as const, payment_method: 'transfer' as const, amount_paid: cls.class_price ?? 0 }
    return { payment_mode: 'drop_in' as const, payment_method: 'cash' as const, amount_paid: cls.class_price ?? 0 }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const { payment_mode, payment_method, amount_paid } = getPayment()
    const hadirList    = participants.filter(p => p.state === 'hadir')
    const notHadirList = participants.filter(p => p.state !== 'hadir')

    // ── STEP 1: Auto-save walk-in baru ke community_contacts ──────────────
    // Walk-in yang belum punya communityId → simpan dulu ke community_contacts
    // supaya next kali datang lagi, langsung muncul di daftar komunitas
    const walkinBaru = hadirList.filter(p => p.source === 'walkin' && !p.communityId)

    for (const p of walkinBaru) {
      // Cek dulu apakah nomornya sudah ada di komunitas (hindari duplikat)
      const existing = p.phone
        ? await supabase
            .from('community_contacts')
            .select('id')
            .eq('user_id', session.user_id)
            .eq('phone', p.phone)
            .maybeSingle()
        : { data: null }

      if (!existing.data) {
        // Belum ada → insert baru ke community_contacts
        const { data: newContact } = await supabase
          .from('community_contacts')
          .insert({
            user_id:    session.user_id,
            name:       p.name || null,
            phone:      p.phone || null,
            class_type: cls.type,   // otomatis sesuai jenis kelas sesi ini
            source:     'walkin',
          })
          .select('id')
          .single()

        // Update participant entry dengan communityId yang baru
        if (newContact) {
          p.communityId = newContact.id
        }
      } else {
        // Sudah ada → pakai id yang existing
        p.communityId = existing.data.id
      }
    }

    // ── STEP 2: Upsert attendance ─────────────────────────────────────────
    const toUpsert = hadirList.map(p => ({
      session_id:        session.id,
      user_id:           session.user_id,
      source:            p.source,
      member_id:         p.memberId ?? null,
      community_id:      p.communityId ?? null,
      // registrant_name/phone hanya diisi kalau walk-in tanpa communityId
      // (edge case: gagal insert community_contacts)
      registrant_name:   (!p.memberId && !p.communityId) ? p.name : null,
      registrant_phone:  (!p.memberId && !p.communityId) ? p.phone : null,
      payment_mode,
      payment_method,
      amount_paid,
    }))

    if (toUpsert.length > 0) {
      const { error: err } = await supabase
        .from('attendance')
        .upsert(toUpsert, { ignoreDuplicates: false })
      if (err) {
        setError('Ups, ada yang salah. Coba lagi ya 🙏')
        setSaving(false)
        return
      }
    }

    // ── STEP 3: Hapus yang tidak hadir ────────────────────────────────────
    for (const p of notHadirList) {
      if (p.memberId) {
        await supabase.from('attendance').delete()
          .eq('session_id', session.id).eq('member_id', p.memberId)
      } else if (p.communityId) {
        await supabase.from('attendance').delete()
          .eq('session_id', session.id).eq('community_id', p.communityId)
      }
    }

    setSaving(false)
    setToast(`Absensi tersimpan! ${hadirCount} orang hadir ✓`)
    setTimeout(() => {
      router.push(`/classes/${cls.id}`)
      router.refresh()
    }, 2500)
  }

  // Group participants by source for display
  const memberList  = participants.filter(p => p.source === 'member')
  const bookingList = participants.filter(p => p.source === 'booking')
  const walkinList  = participants.filter(p => p.source === 'walkin')

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

      {/* ── CONTENT ── */}
      <div className="flex-1 p-4 pb-28 space-y-6">

        {/* Section: Members */}
        {memberList.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-3">
              Member Langganan ({memberList.length})
            </p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {memberList.map(p => (
                <ParticipantCard
                  key={p.key}
                  name={p.name}
                  photoUrl={p.photoUrl}
                  badge="member"
                  state={p.state}
                  onTap={() => tap(p.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Section: Booking */}
        {bookingList.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-3">
              Sudah Booking ({bookingList.length})
            </p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {bookingList.map(p => (
                <ParticipantCard
                  key={p.key}
                  name={p.name}
                  badge="booking"
                  state={p.state}
                  onTap={() => tap(p.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Section: Walk-in */}
        {walkinList.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-3">
              Walk-in / Tiba-tiba ({walkinList.length})
            </p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {walkinList.map(p => (
                <ParticipantCard
                  key={p.key}
                  name={p.name}
                  badge="walkin"
                  state={p.state}
                  onTap={() => tap(p.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {participants.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Belum ada peserta.</p>
            <p className="text-xs mt-1">Tap tombol + untuk tambah peserta walk-in.</p>
          </div>
        )}
      </div>

      {/* ── FLOATING ADD BUTTON ── */}
      <button
        onClick={() => setShowWalkin(true)}
        className="fixed bottom-24 right-4 z-20 w-12 h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <UserPlus className="w-5 h-5" />
      </button>

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

      {/* ── WALK-IN MODAL ── */}
      {showWalkin && (
        <WalkinModal
          communityContacts={communityContacts}
          existingKeys={existingKeys}
          onAdd={addWalkin}
          onClose={() => setShowWalkin(false)}
        />
      )}
    </div>
  )
}
