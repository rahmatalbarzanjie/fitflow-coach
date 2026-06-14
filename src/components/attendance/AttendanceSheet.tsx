'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Square, Save, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PAYMENT_MODE } from '@/lib/constants'
import { formatDateShort, formatTime } from '@/lib/utils'

interface Member {
  id: string
  name: string
  phone: string
  status: string | null
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
}

interface Row {
  checked: boolean
  payment_mode: string
  amount_paid: string
  attendance_id: string | null
}

interface Props {
  cls: ClassInfo
  session: Session
  members: Member[]
  existingAttendance: AttendanceRecord[]
}

const PAYMENT_MODES = Object.entries(PAYMENT_MODE).map(([k, v]) => ({ value: k, label: v.label }))

export function AttendanceSheet({ cls, session, members, existingAttendance }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const init: Record<string, Row> = {}
    for (const m of members) {
      const ex = existingAttendance.find(a => a.member_id === m.id)
      init[m.id] = {
        checked:        !!ex,
        payment_mode:   ex?.payment_mode ?? 'drop_in',
        amount_paid:    ex ? String(Number(ex.amount_paid)) : '0',
        attendance_id:  ex?.id ?? null,
      }
    }
    return init
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(m => m.name.toLowerCase().includes(q) || m.phone.includes(q))
  }, [members, search])

  const checkedCount = useMemo(
    () => Object.values(rows).filter(r => r.checked).length,
    [rows]
  )

  function toggle(memberId: string) {
    setRows(prev => ({ ...prev, [memberId]: { ...prev[memberId], checked: !prev[memberId].checked } }))
    setSaved(false)
  }

  function update(memberId: string, field: 'payment_mode' | 'amount_paid', value: string) {
    setRows(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }))
    setSaved(false)
  }

  function markAll(checked: boolean) {
    setRows(prev => {
      const next = { ...prev }
      for (const id of Object.keys(next)) next[id] = { ...next[id], checked }
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const toUpsert = members
      .filter(m => rows[m.id].checked)
      .map(m => ({
        session_id:     session.id,
        member_id:      m.id,
        user_id:        session.user_id,
        payment_mode:   rows[m.id].payment_mode as 'free' | 'drop_in' | 'prepaid' | 'debt',
        payment_method: null as 'cash' | 'transfer' | null,
        amount_paid:    rows[m.id].payment_mode === 'free' ? 0 : (parseFloat(rows[m.id].amount_paid) || 0),
      }))

    if (toUpsert.length > 0) {
      const { error: err } = await supabase
        .from('attendance')
        .upsert(toUpsert, { onConflict: 'session_id,member_id' })
      if (err) { setError(err.message); setSaving(false); return }
    }

    // Remove attendance for unchecked members who previously had a record
    const toDelete = members
      .filter(m => !rows[m.id].checked && rows[m.id].attendance_id)
      .map(m => m.id)

    if (toDelete.length > 0) {
      await supabase
        .from('attendance')
        .delete()
        .eq('session_id', session.id)
        .in('member_id', toDelete)

      // Clear stale attendance_ids from local state
      setRows(prev => {
        const next = { ...prev }
        for (const id of toDelete) next[id] = { ...next[id], attendance_id: null }
        return next
      })
    }

    setSaved(true)
    setSaving(false)
    router.refresh()
  }

  const saveLabel = saving ? 'Menyimpan...' : saved ? 'Tersimpan ✓' : `Simpan (${checkedCount} hadir)`

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{cls.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDateShort(session.session_date)} · {formatTime(session.start_time)}–{formatTime(session.end_time)}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
        >
          <Save className="w-4 h-4" />
          {saveLabel}
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama atau nomor HP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
        </div>
        <button
          onClick={() => markAll(true)}
          className="h-9 px-3 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap"
        >
          Pilih Semua
        </button>
        <button
          onClick={() => markAll(false)}
          className="h-9 px-3 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap"
        >
          Hapus Semua
        </button>
      </div>

      {/* Member list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Tidak ada member ditemukan</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(m => {
              const row = rows[m.id]
              const isFree = row.payment_mode === 'free'
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    row.checked ? 'bg-violet-50/40' : 'hover:bg-gray-50/50'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggle(m.id)}
                    className={`shrink-0 ${row.checked ? 'text-violet-600' : 'text-gray-300 hover:text-gray-400'}`}
                  >
                    {row.checked
                      ? <CheckSquare className="w-5 h-5" />
                      : <Square className="w-5 h-5" />
                    }
                  </button>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${row.checked ? 'text-gray-900' : 'text-gray-400'}`}>
                      {m.name}
                    </p>
                    <p className="text-xs text-gray-400">{m.phone}</p>
                  </div>

                  {/* Payment controls — only when checked */}
                  {row.checked && (
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={row.payment_mode}
                        onChange={e => update(m.id, 'payment_mode', e.target.value)}
                        className="h-8 px-2 pr-6 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        {PAYMENT_MODES.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      {!isFree && (
                        <input
                          type="number"
                          value={row.amount_paid}
                          onChange={e => update(m.id, 'amount_paid', e.target.value)}
                          placeholder="0"
                          min="0"
                          className="w-28 h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom save (only when list is long) */}
      {members.length > 8 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  )
}
