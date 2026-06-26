'use client'

import { useEffect, useState } from 'react'

interface Props {
  eventDate: string  // YYYY-MM-DD
  startTime: string  // HH:MM:SS
}

function getRemaining(target: Date) {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return null
  const hours   = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1_000)
  return { hours, minutes, seconds }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function EventCountdown({ eventDate, startTime }: Props) {
  const target = new Date(`${eventDate}T${startTime}`)
  // Mulai dari `undefined` (belum dihitung), BUKAN getRemaining(target) -
  // Date.now() di server (saat SSR) dan di client (saat hydrate) beda
  // beberapa detik, jadi kalau dihitung langsung di initial state, server
  // dan client render angka yang berbeda -> hydration mismatch. Placeholder
  // yang sama di kedua sisi, baru dihitung ulang via useEffect (client-only).
  const [remaining, setRemaining] = useState<ReturnType<typeof getRemaining> | undefined>(undefined)

  useEffect(() => {
    setRemaining(getRemaining(target))
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventDate, startTime])

  if (remaining === undefined) {
    return (
      <div className="bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 tabular-nums">
        <span className="material-symbols-outlined text-sm">timer</span>
        --:--:--
      </div>
    )
  }

  if (!remaining) {
    return (
      <div className="bg-red-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg animate-pulse">
        Sedang Berlangsung
      </div>
    )
  }

  return (
    <div className="bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 tabular-nums">
      <span className="material-symbols-outlined text-sm">timer</span>
      {pad(remaining.hours)}:{pad(remaining.minutes)}:{pad(remaining.seconds)}
    </div>
  )
}
