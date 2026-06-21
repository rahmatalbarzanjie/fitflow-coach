'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, MapPin, Loader2 } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'

interface Props {
  classId:    string
  className:  string
  location:   string | null
  dayOfWeek:  number
  startTime:  string
  endTime:    string
}

type ActionType = 'reschedule' | 'location'

// Compute next N occurrences of a given day-of-week from today
function upcomingDates(dayOfWeek: number, count = 5): string[] {
  const dates: string[] = []
  const d = new Date()
  while (dates.length < count) {
    if (d.getDay() === dayOfWeek) dates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return dates
}

export function ClassScheduleManager({ classId, dayOfWeek }: Props) {
  const router = useRouter()
  const [loadingDate, setLoadingDate] = useState<string | null>(null)
  const [error,        setError      ] = useState('')

  const dates = upcomingDates(dayOfWeek, 5)

  async function goTo(date: string, action: ActionType) {
    setLoadingDate(date)
    setError('')
    try {
      const res  = await fetch('/api/sessions/ensure', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ classId, sessionDate: date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/classes/${classId}/sessions/${data.session.id}/${action}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat sesi')
      setLoadingDate(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm font-semibold text-gray-900">Kelola Jadwal</p>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Pilih tanggal untuk reschedule atau ubah lokasi satu sesi.
      </p>

      <div className="space-y-2">
        {dates.map(date => {
          const isLoading = loadingDate === date
          const label     = formatDateShort(date)
          const isToday   = date === new Date().toISOString().split('T')[0]

          return (
            <div
              key={date}
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                isToday ? 'border-violet-200 bg-violet-50/40' : 'border-gray-100 hover:border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isLoading && <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />}
                <span className="text-sm font-medium text-gray-800">{label}</span>
                {isToday && (
                  <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-bold">Hari Ini</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => goTo(date, 'reschedule')}
                  disabled={!!loadingDate}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border border-orange-200 text-orange-600 hover:bg-orange-50 disabled:opacity-40 transition-colors"
                  title="Reschedule sesi ini"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reschedule</span>
                </button>
                <button
                  onClick={() => goTo(date, 'location')}
                  disabled={!!loadingDate}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                  title="Ubah lokasi sesi ini"
                >
                  <MapPin className="w-3 h-3" />
                  <span className="hidden sm:inline">Ubah Lokasi</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
    </div>
  )
}
