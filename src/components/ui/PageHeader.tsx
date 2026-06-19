/**
 * PageHeader — Header mobile-first untuk semua halaman dalam modul.
 *
 * Pola: [ ← Back ]  [ Title ]  [ Action ]
 *
 * Digunakan di:
 * - /classes/[id]
 * - /classes/[id]/attendance
 * - /classes/[id]/registrations
 * - /classes/new, /classes/[id]/edit
 * - Dan semua halaman detail modul lain (Member, Event, dll)
 *
 * Props:
 * - title: judul halaman (wajib)
 * - subtitle: sub-info kecil di bawah title (opsional)
 * - backHref: URL tombol back (opsional — kalau tidak ada, tombol back tidak muncul)
 * - action: node JSX untuk tombol aksi di kanan (opsional)
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title:     string
  subtitle?: string
  backHref?: string
  action?:   React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, backHref, action, className }: Props) {
  return (
    <div className={cn('flex items-center gap-3 mb-6', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-gray-900 leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {action && (
        <div className="shrink-0">{action}</div>
      )}
    </div>
  )
}
