'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { invalidateDashboardCache } from '@/lib/invalidate-dashboard'
import { MoreHorizontal, Pencil, Trash2, X, Loader2, CalendarDays } from 'lucide-react'
import { ClassEditForm } from '@/components/classes/ClassEditForm'
import { ClassScheduleManager } from '@/app/(dashboard)/classes/[id]/ClassScheduleManager'
import { WaGroupPicker } from '@/components/classes/WaGroupPicker'
import { formatDateShort, formatTime } from '@/lib/utils'
import Link from 'next/link'
import { CheckSquare } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cls {
  id: string; name: string; type: string
  day_of_week: number; start_time: string; end_time: string
  location: string | null; capacity: number | null
  description?: string | null; class_price?: number | null
  revenue_share_pct?: number | null; cover_image_url?: string | null
  show_registrations?: boolean | null
  wa_group_id?: string | null; wa_group_name?: string | null
}

interface Session {
  id: string; session_date: string; session_type: string
  start_time: string; end_time: string; notified_at: string | null
  attendance: { id: string }[]
}

type Tab = 'info' | 'jadwal' | 'riwayat'
type Modal = 'edit' | 'delete' | null

interface Props { cls: Cls }

// ─── Tab Riwayat ─────────────────────────────────────────────────────────────

function TabRiwayat({ cls }: { cls: Cls }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading ] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await (supabase.from('sessions') as any)
      .select('id, session_date, session_type, start_time, end_time, notified_at, attendance(id)')
      .eq('class_id', cls.id)
      .order('session_date', { ascending: false })
      .limit(20)
    setSessions(data ?? [])
    setLoading(false)
  }, [cls.id])

  useEffect(() => { load() }, [load])

  const SESSION_TYPE_BADGE: Record<string, { label: string; color: string }> = {
    rescheduled:      { label: 'Dijadwal Ulang', color: 'bg-orange-50 text-orange-700' },
    extra:            { label: 'Ekstra',          color: 'bg-green-50 text-green-700'  },
    location_changed: { label: 'Lokasi Baru',     color: 'bg-blue-50 text-blue-700'    },
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
    </div>
  )

  if (!sessions.length) return (
    <div className="text-center py-16 px-6">
      <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Belum ada riwayat sesi</p>
      <p className="text-xs text-gray-300 mt-1">Sesi muncul setelah absensi pertama</p>
    </div>
  )

  return (
    <div className="px-6 py-4 divide-y divide-gray-50">
      {sessions.map(s => {
        const count   = Array.isArray(s.attendance) ? s.attendance.length : 0
        const isToday = s.session_date === today
        const isPast  = s.session_date < today
        const badge   = s.session_type !== 'regular' ? SESSION_TYPE_BADGE[s.session_type] : null

        return (
          <div key={s.id} className={`flex items-center justify-between py-3 ${isToday ? '-mx-6 px-6 bg-violet-50/50' : ''}`}>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-800">{formatDateShort(s.session_date)}</p>
                {isToday && <span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-bold">Hari Ini</span>}
                {badge && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatTime(s.start_time)}–{formatTime(s.end_time)}
                {count > 0 && <span className="ml-2 font-semibold text-gray-600">{count} hadir</span>}
              </p>
            </div>
            <Link
              href={`/classes/${cls.id}/attendance?date=${s.session_date}`}
              className={`flex items-center gap-1 h-7 px-3 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                isToday || !isPast
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              {count > 0 ? 'Lihat' : 'Absen'}
            </Link>
          </div>
        )
      })}
    </div>
  )
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ cls, onClose }: { cls: Cls; onClose: () => void }) {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await (supabase.from('classes') as any).delete().eq('id', cls.id)
    invalidateDashboardCache()
    onClose()
    router.push('/classes')
    router.refresh()
  }

  return (
    <div className="px-6 py-5">
      <p className="text-sm text-gray-600 mb-1">Yakin ingin menghapus kelas ini?</p>
      <p className="text-sm font-semibold text-gray-900 mb-3">"{cls.name}"</p>
      <p className="text-xs text-red-500 mb-5">Semua sesi dan riwayat absensi juga akan terhapus.</p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
        <button onClick={handleDelete} disabled={loading}
          className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Menghapus...' : 'Ya, Hapus'}
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ClassRowActions({ cls }: Props) {
  const [dropdown, setDropdown] = useState(false)
  const [modal,    setModal   ] = useState<Modal>(null)
  const [tab,      setTab     ] = useState<Tab>('info')

  function openEdit() { setDropdown(false); setTab('info'); setModal('edit') }
  function openDelete() { setDropdown(false); setModal('delete') }
  function closeModal() { setModal(null) }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info',    label: 'Info & Edit'  },
    { key: 'jadwal',  label: 'Jadwal'       },
    { key: 'riwayat', label: 'Riwayat Sesi' },
  ]

  return (
    <>
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setDropdown(v => !v)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {dropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdown(false)} />
            <div className="absolute right-0 top-8 z-20 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
              <button onClick={openEdit}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit Kelas
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={openDelete}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Hapus Kelas
              </button>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal — 3 tabs */}
      {modal === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg z-10 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-gray-900 truncate">{cls.name}</h2>
              </div>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 ml-3 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-4 border-b border-gray-100 shrink-0">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                    tab === t.key
                      ? 'border-violet-600 text-violet-600 bg-violet-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1">
              {tab === 'info' && (
                <div className="px-6 py-5">
                  {/* Pakai ClassEditForm yang sudah ada — persis sama dengan halaman detail */}
                  <ClassEditForm cls={cls} inModal onClose={closeModal} />
                  {/* Grup WA */}
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Grup WA Kelas</p>
                    <WaGroupPicker
                      classId={cls.id}
                      currentGroupId={cls.wa_group_id ?? null}
                      currentGroupName={cls.wa_group_name ?? null}
                    />
                  </div>
                </div>
              )}

              {tab === 'jadwal' && (
                <div className="px-6 py-5">
                  <ClassScheduleManager
                    classId={cls.id}
                    className={cls.name}
                    location={cls.location}
                    dayOfWeek={cls.day_of_week}
                    startTime={cls.start_time}
                    endTime={cls.end_time}
                  />
                </div>
              )}

              {tab === 'riwayat' && <TabRiwayat cls={cls} />}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Hapus Kelas</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <DeleteModal cls={cls} onClose={closeModal} />
          </div>
        </div>
      )}
    </>
  )
}
