'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// Display order: Mon=1, Tue=2, ..., Sat=6, Sun=0
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS    = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const TODAY_DOW     = new Date().getDay() // 0=Sun, 1=Mon, ... 6=Sat

const TYPE_STYLE: Record<string, string> = {
  poundfit: 'bg-orange-50 text-orange-700 border-orange-200',
  barre:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  yoga:     'bg-green-50  text-green-700  border-green-200',
  pilates:  'bg-blue-50   text-blue-700   border-blue-200',
  zumba:    'bg-violet-50 text-violet-700 border-violet-200',
  aerobic:  'bg-red-50    text-red-700    border-red-200',
  other:    'bg-gray-50   text-gray-600   border-gray-200',
}

interface ClassRow {
  id: string
  name: string
  type: string
  day_of_week: number
  start_time: string
}

export function WeekCalendar({ userId }: { userId: string }) {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('classes')
      .select('id, name, type, day_of_week, start_time')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('start_time')
      .then(({ data }) => setClasses((data as ClassRow[]) ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const hasAny = classes.length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Kalender Mingguan</h2>
        <Link href="/classes" className="text-xs text-violet-600 hover:underline">Kelola kelas</Link>
      </div>

      {!hasAny ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">Belum ada kelas terdaftar</p>
          <Link href="/classes/new" className="text-xs text-violet-600 hover:underline mt-1 block">
            + Tambah kelas
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1 pt-1 pb-1">
          <div className="grid grid-cols-7 gap-1.5 min-w-[480px]">
            {DISPLAY_ORDER.map((dow, i) => {
              const isToday  = dow === TODAY_DOW
              const dayClass = classes.filter(c => c.day_of_week === dow)
              return (
                <div
                  key={dow}
                  className={`rounded-xl p-1.5 ${isToday ? 'bg-violet-50 ring-1 ring-violet-200' : 'bg-white border border-gray-100'}`}
                >
                  <p className={`text-center text-[11px] font-bold mb-2 ${isToday ? 'text-violet-700' : 'text-gray-400'}`}>
                    {DAY_LABELS[i]}
                  </p>
                  <div className="flex flex-col gap-1.5 min-h-[40px]">
                    {dayClass.length === 0 ? (
                      <div className="h-8 rounded-lg border border-dashed border-gray-100" />
                    ) : (
                      dayClass.map(c => (
                        <Link key={c.id} href={`/classes/${c.id}`}>
                          <div className={`rounded-lg border px-1.5 py-1.5 text-[10px] cursor-pointer hover:opacity-75 transition-opacity leading-tight ${TYPE_STYLE[c.type] ?? TYPE_STYLE.other}`}>
                            <p className="font-semibold truncate">{c.name}</p>
                            <p className="opacity-70 mt-0.5">{String(c.start_time).substring(0, 5)}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
