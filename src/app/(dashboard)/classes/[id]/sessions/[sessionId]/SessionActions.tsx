'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, MapPin, CheckSquare, AlertTriangle } from 'lucide-react'
import { RescheduleModal } from '@/components/classes/RescheduleModal'
import { ChangeLocationModal } from '@/components/classes/ChangeLocationModal'

interface Props {
  session: {
    id: string
    class_id: string
    session_date: string
    start_time: string
    end_time: string
    session_type: string
  }
  cls: {
    id: string
    name: string
    location: string | null
    day_of_week: number
  }
}

export function SessionActions({ session, cls }: Props) {
  const router = useRouter()
  const [showReschedule, setShowReschedule] = useState(false)
  const [showLocation,   setShowLocation  ] = useState(false)
  const [cancelling,     setCancelling    ] = useState(false)
  const [cancelError,    setCancelError   ] = useState('')

  async function handleCancel() {
    if (!confirm('Batalkan sesi ini? Tindakan ini tidak bisa diundur.')) return
    setCancelling(true)
    setCancelError('')
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await fetch(`/api/sessions/${session.id}/cancel`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Gagal membatalkan sesi')
      router.push(`/classes/${cls.id}`)
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setCancelling(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Kelola Sesi Ini</p>
        <div className="space-y-2.5">
          <button
            onClick={() => setShowReschedule(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-all"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span>🔄 Reschedule Sesi Ini</span>
          </button>
          <button
            onClick={() => setShowLocation(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all"
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>📍 Ubah Lokasi Sesi Ini</span>
          </button>
          <Link
            href={`/classes/${cls.id}/attendance?date=${session.session_date}`}
            className="w-full flex items-center gap-3 px-4 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            <span>✓ Absensi</span>
          </Link>
        </div>
      </div>

      {/* Cancel */}
      <div className="text-center">
        {cancelError && (
          <p className="text-xs text-red-500 mb-2 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {cancelError}
          </p>
        )}
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="text-sm text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 transition-colors"
        >
          {cancelling ? 'Membatalkan...' : 'Batalkan sesi ini'}
        </button>
      </div>

      {/* Modals */}
      {showReschedule && (
        <RescheduleModal
          sessionId={session.id}
          classId={cls.id}
          className={cls.name}
          location={cls.location ?? ''}
          dayOfWeek={cls.day_of_week}
          sessionDate={session.session_date}
          startTime={session.start_time}
          endTime={session.end_time}
          onClose={() => setShowReschedule(false)}
        />
      )}
      {showLocation && (
        <ChangeLocationModal
          sessionId={session.id}
          className={cls.name}
          dayOfWeek={cls.day_of_week}
          startTime={session.start_time}
          endTime={session.end_time}
          oldLocation={cls.location ?? ''}
          onClose={() => setShowLocation(false)}
        />
      )}
    </>
  )
}
