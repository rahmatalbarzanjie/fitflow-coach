'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, MapPin, CheckSquare, AlertTriangle, Calendar, Users } from 'lucide-react'
import { getDayName, formatTime, formatRupiah } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ClassRowActions } from '@/components/classes/ClassRowActions'
import { ClassDetailModal } from '@/components/classes/ClassDetailModal'

const TYPE_COLOR: Record<string, 'violet' | 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'gray'> = {
  zumba: 'violet', yoga: 'green', pilates: 'blue',
  poundfit: 'orange', aerobic: 'red', barre: 'yellow', other: 'gray',
}

const SESSION_BADGE: Record<string, { label: string; color: 'orange' | 'green' | 'blue' }> = {
  rescheduled:      { label: 'Dijadwal Ulang', color: 'orange' },
  extra:            { label: 'Ekstra',          color: 'green'  },
  location_changed: { label: 'Lokasi Baru',     color: 'blue'   },
}

interface TypeOption { value: string; label: string }

interface Props {
  classes:    any[]
  allClasses: any[]
  todayMap:   Record<string, any>
  attendMap:  Record<string, number>
  typeFilter: string
  usedTypes:  TypeOption[]
  typeLabel:  Record<string, string>
  today:      string
  todayDow:   number
  todayCount: number
}

export function ClassesTable({
  classes, allClasses, todayMap, attendMap,
  typeFilter, usedTypes, typeLabel, today, todayDow, todayCount,
}: Props) {
  const [selectedCls, setSelectedCls] = useState<any | null>(null)

  return (
    <>
      {!classes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Belum ada kelas</p>
          <p className="text-xs text-gray-400">Tambahkan jadwal kelas pertama kamu</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Filter + info */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <p className="text-xs text-gray-400">
              {todayCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full text-[10px] font-medium mr-2">
                  <Calendar className="w-3 h-3" /> {todayCount} kelas hari ini
                </span>
              )}
              Menampilkan <span className="font-semibold text-gray-600">{classes.length}</span> dari <span className="font-semibold text-gray-600">{allClasses.length}</span> kelas
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <a href="/classes"
                className={`h-8 px-4 rounded-full text-xs font-medium transition-colors flex items-center ${!typeFilter ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Semua
              </a>
              {usedTypes.map(t => (
                <a key={t.value} href={`/classes?type=${t.value}`}
                  className={`h-8 px-4 rounded-full text-xs font-medium transition-colors flex items-center ${typeFilter === t.value ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t.label}
                </a>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kelas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Jadwal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Lokasi</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kapasitas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Harga</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Total Hadir</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {classes.map((cls: any) => {
                  const isToday    = cls.day_of_week === todayDow
                  const todaySess  = todayMap[cls.id]
                  const sessType   = todaySess?.session_type
                  const sessBadge  = sessType && SESSION_BADGE[sessType] ? SESSION_BADGE[sessType] : null
                  const unnotified = todaySess && sessType !== 'regular' && !todaySess.notified_at

                  return (
                    <tr key={cls.id} className={`transition-colors ${isToday ? 'bg-violet-50/40' : 'hover:bg-gray-50'}`}>
                      {/* Nama — klik buka modal detail */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isToday && <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-medium">Hari Ini</span>}
                          <button
                            onClick={() => setSelectedCls(cls)}
                            className="font-semibold text-gray-900 hover:text-violet-700 text-sm text-left underline-offset-2 hover:underline"
                          >
                            {cls.name}
                          </button>
                          <Badge color={TYPE_COLOR[cls.type] ?? 'gray'}>{typeLabel[cls.type] ?? cls.type}</Badge>
                          {sessBadge && <Badge color={sessBadge.color}>{sessBadge.label}</Badge>}
                        </div>
                        {unnotified && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 text-orange-500" />
                            <span className="text-[10px] text-orange-600">Member belum diinfokan</span>
                            <Link href="/broadcasts" className="text-[10px] text-orange-600 font-semibold underline">Kirim Info</Link>
                          </div>
                        )}
                      </td>

                      {/* Jadwal */}
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-gray-700">{getDayName(cls.day_of_week)}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />{formatTime(cls.start_time)}–{formatTime(cls.end_time)}
                        </p>
                      </td>

                      {/* Lokasi */}
                      <td className="px-4 py-3">
                        {(todaySess?.override_location || cls.location) ? (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-300" />{todaySess?.override_location ?? cls.location}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>

                      {/* Kapasitas */}
                      <td className="px-4 py-3">
                        {cls.capacity
                          ? <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3 text-gray-300" />{cls.capacity} orang</span>
                          : <span className="text-xs text-gray-300">Bebas</span>}
                      </td>

                      {/* Harga */}
                      <td className="px-4 py-3">
                        {cls.class_price > 0
                          ? <span className="text-xs font-medium text-gray-700">{formatRupiah(cls.class_price)}</span>
                          : <span className="text-xs text-green-600 font-medium">Gratis</span>}
                      </td>

                      {/* Total hadir */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-gray-700">{attendMap[cls.id] ?? 0}</span>
                        <span className="text-xs text-gray-400 ml-1">sesi</span>
                      </td>

                      {/* Aksi */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {isToday && (
                            <Link href={`/classes/${cls.id}/attendance?date=${today}`}
                              className="flex items-center gap-1 h-7 px-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors">
                              <CheckSquare className="w-3 h-3" /> Absen
                            </Link>
                          )}
                          <ClassRowActions cls={cls} allClasses={allClasses} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCls && (
        <ClassDetailModal
          cls={selectedCls}
          onClose={() => setSelectedCls(null)}
        />
      )}
    </>
  )
}
