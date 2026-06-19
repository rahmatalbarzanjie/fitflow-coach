/**
 * ClassesFilter — Filter kelas by tipe, client-side (tidak reload page).
 * Hanya muncul kalau instruktur punya > 1 jenis kelas.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ClassCard } from '@/components/classes/ClassCard'

interface TypeOption { value: string; label: string }

interface Props {
  types:          TypeOption[]
  todayClasses:   any[]
  otherClasses:   any[]
  attendTodayMap: Record<string, number>
  today:          string
  todayDow:       number
  typeLabel:      Record<string, string>
}

export function ClassesFilter({
  types, todayClasses, otherClasses, attendTodayMap, today, typeLabel,
}: Props) {
  const [active, setActive] = useState('') // '' = semua

  const filteredToday = active
    ? todayClasses.filter(c => c.type === active)
    : todayClasses

  const filteredOther = active
    ? otherClasses.filter(c => c.type === active)
    : otherClasses

  const isEmpty = filteredToday.length === 0 && filteredOther.length === 0

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <button
          onClick={() => setActive('')}
          className={`h-8 px-4 rounded-full text-xs font-semibold transition-colors ${
            !active
              ? 'bg-violet-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Semua
        </button>
        {types.map(t => (
          <button
            key={t.value}
            onClick={() => setActive(v => v === t.value ? '' : t.value)}
            className={`h-8 px-4 rounded-full text-xs font-semibold transition-colors ${
              active === t.value
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🎯</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">Belum ada kelas</p>
          <p className="text-xs text-gray-400 mb-5">Tambahkan jadwal kelas pertama kamu</p>
          <Link
            href="/classes/new"
            className="inline-flex items-center gap-1.5 h-9 px-5 bg-violet-600 text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Tambah Kelas
          </Link>
        </div>
      )}

      {/* Kelas hari ini */}
      {filteredToday.length > 0 && (
        <section className="mb-5">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-3">
            Hari Ini
          </p>
          <div className="space-y-3">
            {filteredToday.map((cls: any) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                isToday={true}
                attendCount={attendTodayMap[cls.id] ?? 0}
                sessionDate={today}
                typeLabel={typeLabel}
              />
            ))}
          </div>
        </section>
      )}

      {/* Kelas lainnya */}
      {filteredOther.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Jadwal Lainnya
          </p>
          <div className="space-y-3">
            {filteredOther.map((cls: any) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                isToday={false}
                attendCount={0}
                typeLabel={typeLabel}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
