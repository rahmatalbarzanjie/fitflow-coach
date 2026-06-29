/**
 * ClassCard — Card kelas untuk list halaman /classes
 *
 * Mobile-first. Menampilkan info kunci yang instruktur butuhkan:
 * nama, hari/jam, lokasi, jumlah peserta, dan aksi utama.
 *
 * Aksi:
 * - Klik card → /classes/[id] (pusat operasional)
 * - Tombol Absen → /classes/[id]/attendance (langsung, hari ini saja)
 * - Tombol ⋯ → hapus saja
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Clock, Users, CheckSquare, MoreVertical, Trash2, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateDashboardCache } from '@/lib/invalidate-dashboard'
import { getDayName, formatTime, formatRupiah } from '@/lib/utils'

const TYPE_EMOJI: Record<string, string> = {
  poundfit: '⚡', barre: '🩰', zumba: '💃',
  yoga: '🧘', pilates: '🏋️', aerobic: '🔥', other: '🎯',
}

const TYPE_COLOR: Record<string, string> = {
  poundfit: 'bg-orange-100 text-orange-700',
  barre:    'bg-pink-100 text-pink-700',
  zumba:    'bg-violet-100 text-violet-700',
  yoga:     'bg-green-100 text-green-700',
  pilates:  'bg-blue-100 text-blue-700',
  aerobic:  'bg-red-100 text-red-700',
  other:    'bg-gray-100 text-gray-600',
}

interface Props {
  cls: {
    id: string
    name: string
    type: string
    day_of_week: number
    start_time: string
    end_time: string
    location: string | null
    capacity: number | null
    class_price: number | null
    is_active?: boolean
  }
  isToday:      boolean
  attendCount:  number
  sessionDate?: string // tanggal sesi hari ini (kalau ada)
  typeLabel:    Record<string, string>
}

export function ClassCard({ cls, isToday, attendCount, sessionDate, typeLabel }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm,  setConfirm ] = useState(false)
  const [deleting, setDeleting ] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await (supabase.from('classes') as any).delete().eq('id', cls.id)
    invalidateDashboardCache()
    router.refresh()
  }

  const emoji     = TYPE_EMOJI[cls.type] ?? '🎯'
  const typeColor = TYPE_COLOR[cls.type] ?? 'bg-gray-100 text-gray-600'
  const label     = typeLabel[cls.type] ?? cls.type
  const today     = new Date().toISOString().split('T')[0]

  return (
    <div className={`bg-white rounded-2xl border transition-colors ${
      cls.is_active === false ? 'opacity-60' : ''
    } ${
      isToday ? 'border-violet-200 shadow-sm shadow-violet-100' : 'border-gray-100'
    }`}>
      {/* Nonaktif indicator */}
      {cls.is_active === false && (
        <div className="px-4 pt-3 pb-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full">
            Nonaktif
          </span>
        </div>
      )}

      {/* Hari ini indicator */}
      {isToday && (
        <div className="px-4 pt-3 pb-0">
          <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">
            ● Kelas Hari Ini
          </span>
        </div>
      )}

      {/* Main content — klik ke detail */}
      <Link href={`/classes/${cls.id}`} className="block px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Nama + badge tipe */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-base">{emoji}</span>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">{cls.name}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
                {label}
              </span>
            </div>

            {/* Jadwal */}
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{getDayName(cls.day_of_week)} · {formatTime(cls.start_time)}–{formatTime(cls.end_time)}</span>
            </div>

            {/* Lokasi */}
            {cls.location && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{cls.location}</span>
              </div>
            )}
          </div>

          {/* Peserta & harga */}
          <div className="text-right shrink-0">
            {cls.capacity && (
              <div className="flex items-center gap-1 text-xs text-gray-400 justify-end mb-1">
                <Users className="w-3 h-3" />
                <span>{cls.capacity} peserta</span>
              </div>
            )}
            {cls.class_price && cls.class_price > 0 && (
              <p className="text-xs font-semibold text-gray-700">
                {formatRupiah(cls.class_price)}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-gray-50 mt-1">
        {/* Hadir info */}
        <p className="text-xs text-gray-400">
          {isToday && attendCount > 0
            ? <span className="text-green-600 font-semibold">{attendCount} hadir hari ini</span>
            : <span>Tap untuk detail kelas</span>
          }
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Tombol Absen — hanya tampil hari ini */}
          {isToday && (
            <Link
              href={`/classes/${cls.id}/attendance?date=${today}`}
              className="flex items-center gap-1.5 h-8 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Absen
            </Link>
          )}

          {/* Menu ⋯ — hanya hapus */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 bottom-9 z-20 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
                  <button
                    onClick={() => { setMenuOpen(false); setConfirm(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Kelas
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Konfirmasi hapus */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Hapus Kelas?</h3>
              <button onClick={() => setConfirm(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-1">Kamu akan menghapus:</p>
            <p className="text-sm font-semibold text-gray-900 mb-3">"{cls.name}"</p>
            <p className="text-xs text-red-500 mb-5">Semua sesi, absensi, registrasi, dan riwayat pembayaran peserta juga akan terhapus.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
