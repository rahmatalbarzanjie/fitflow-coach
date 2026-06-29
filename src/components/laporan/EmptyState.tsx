import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon:     LucideIcon
  message:  string
  ctaHref?: string
  ctaLabel?: string
}

// Pola sama seperti empty-state yang sudah ada di classes/[id]/registrations
// (icon abu-abu + teks abu-abu di kartu putih) - bukan komponen baru secara
// visual, cuma diekstrak supaya dipakai ulang di 4 section Laporan V2 yang
// kemungkinan besar kosong saat pertama dipakai (Member, Komunitas, Kelas,
// Event - lihat First-Run Audit di plan).
export function EmptyState({ icon: Icon, message, ctaHref, ctaLabel }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <Icon className="w-7 h-7 text-gray-200 mx-auto mb-2.5" />
      <p className="text-sm text-gray-400 mb-3">{message}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center h-9 px-4 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-xs font-semibold transition-colors"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
