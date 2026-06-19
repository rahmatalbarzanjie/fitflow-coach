/**
 * DetailRow — Baris section bergaya Apple Settings.
 *
 * Pola: [ Icon ]  [ Label + Sub ]  [ Value ]  [ › ]
 *
 * Digunakan di:
 * - /classes/[id] — section list operasional kelas
 * - /members/[id] — nanti
 * - /events/[id]  — nanti
 *
 * Bisa berupa:
 * - Link (href) → navigasi ke halaman lain
 * - Button (onClick) → aksi langsung
 * - Static → tampilan info saja (tanpa chevron)
 *
 * Props:
 * - icon: React node (ikon dari lucide-react)
 * - label: teks utama baris
 * - sublabel: teks kecil di bawah label (opsional)
 * - value: teks info di kanan (opsional)
 * - href: kalau ada, baris jadi Link
 * - onClick: kalau ada, baris jadi button
 * - chevron: tampilkan > di kanan (default true kalau ada href/onClick)
 * - danger: warna merah untuk aksi berbahaya (hapus, dll)
 * - badge: node JSX untuk badge/chip di sebelah label (opsional)
 */

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  icon?:      React.ReactNode
  label:      string
  sublabel?:  string
  value?:     string | React.ReactNode
  href?:      string
  onClick?:   () => void
  chevron?:   boolean
  danger?:    boolean
  badge?:     React.ReactNode
  className?: string
  disabled?:  boolean
}

function Inner({ icon, label, sublabel, value, chevron, danger, badge }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {icon && (
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
          danger ? 'bg-red-100' : 'bg-gray-100'
        )}>
          <span className={cn('text-sm', danger ? 'text-red-500' : 'text-gray-500')}>
            {icon}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-sm font-medium leading-tight',
            danger ? 'text-red-600' : 'text-gray-900'
          )}>
            {label}
          </p>
          {badge}
        </div>
        {sublabel && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{sublabel}</p>
        )}
      </div>

      {value && (
        <span className="text-xs text-gray-400 shrink-0 ml-2">{value}</span>
      )}

      {chevron && (
        <ChevronRight className={cn(
          'w-4 h-4 shrink-0 ml-1',
          danger ? 'text-red-300' : 'text-gray-300'
        )} />
      )}
    </div>
  )
}

export function DetailRow({
  href, onClick, chevron, disabled,
  icon, label, sublabel, value, danger, badge, className,
}: Props) {
  const showChevron = chevron ?? !!(href || onClick)

  const innerProps = { icon, label, sublabel, value, chevron: showChevron, danger, badge }

  const base = cn(
    'w-full text-left transition-colors',
    disabled && 'opacity-40 pointer-events-none',
    href || onClick
      ? danger
        ? 'hover:bg-red-50 active:bg-red-100'
        : 'hover:bg-gray-50 active:bg-gray-100'
      : '',
    className
  )

  if (href) {
    return (
      <Link href={href} className={base}>
        <Inner {...innerProps} />
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        <Inner {...innerProps} />
      </button>
    )
  }

  return (
    <div className={base}>
      <Inner {...innerProps} />
    </div>
  )
}
