'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const TODAY_IDX = new Date().getDay()

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
  end_time: string
  location: string | null
}

export function WeekCalendar({ userId }: { userId: string }) {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('classes')
      .select('id, name, type, day_of_week, start_time, end_time, location')
      .eq('user_id', userId)
      .order('start_time')
      .then(({ data }) => setClasses((data as ClassRow[]) ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const byDay = DAYS.map((_, i) => classes.filter(c => c.day_of_week === i))
  const hasAny = classes.length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Kalender Mingguan</h2>
        <Link href="/classes" className="text-xs text-violet-600 hover:underline">Kelola kelas</Link>
      </div>

      {!hasAny ? (
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm text-gray-400">Belum ada kelas terdaftar</p>
          <Link href="/classes/new" className="text-xs text-violet-600 hover:underline mt-1 block">
            + Tambah kelas
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div className="grid grid-cols-7 gap-1.5 min-w-[480px]">
            {DAYS.map((day, i) => (
              <div
                key={i}
                className={`rounded-xl p-1.5 ${i === TODAY_IDX ? 'bg-violet-50 ring-1 ring-violet-200' : 'bg-white border border-gray-100'}`}
              >
                <p className={`text-center text-[11px] font-bold mb-1.5 ${i === TODAY_IDX ? 'text-violet-700' : 'text-gray-400'}`}>
                  {day}
                </p>
                <div className="space-y-1 min-h-[40px]">
                  {byDay[i].length === 0 ? (
                    <div className="h-8 rounded-lg border border-dashed border-gray-100" />
                  ) : (
                    byDay[i].map(c => (
                      <Link key={c.id} href={`/classes/${c.id}`}>
                        <div className={`rounded-lg border px-1.5 py-1 text-[10px] cursor-pointer hover:opacity-75 transition-opacity leading-tight ${TYPE_STYLE[c.type] ?? TYPE_STYLE.other}`}>
                          <p className="font-semibold truncate">{c.name}</p>
                          <p className="opacity-70">{String(c.start_time).substring(0, 5)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
