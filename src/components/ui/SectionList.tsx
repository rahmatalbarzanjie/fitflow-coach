/**
 * SectionList — Container section bergaya Apple Settings.
 *
 * Pola:
 * LABEL SECTION (opsional)
 * ┌─────────────────────────────┐
 * │ DetailRow                   │
 * │─────────────────────────────│
 * │ DetailRow                   │
 * │─────────────────────────────│
 * │ DetailRow                   │
 * └─────────────────────────────┘
 * Keterangan section (opsional)
 *
 * Digunakan di:
 * - /classes/[id] — grouping section operasional
 * - /members/[id] — nanti
 * - /events/[id]  — nanti
 *
 * Props:
 * - label: judul section di atas (HURUF KAPITAL KECIL, opsional)
 * - footer: teks keterangan di bawah section (opsional)
 * - children: DetailRow atau konten lain
 */

import { cn } from '@/lib/utils'

interface Props {
  label?:    string
  footer?:   string
  children:  React.ReactNode
  className?: string
}

export function SectionList({ label, footer, children, className }: Props) {
  return (
    <div className={cn('mb-4', className)}>
      {label && (
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
          {label}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {children}
      </div>

      {footer && (
        <p className="text-xs text-gray-400 px-1 mt-2 leading-relaxed">
          {footer}
        </p>
      )}
    </div>
  )
}
