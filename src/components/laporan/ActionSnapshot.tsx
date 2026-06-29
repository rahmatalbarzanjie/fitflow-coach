import Link from 'next/link'
import { CheckCircle2, ChevronRight, type LucideIcon } from 'lucide-react'

export interface ActionItem {
  icon:     LucideIcon
  iconBg:   string
  iconColor: string
  title:    string
  subtitle?: string
  href?:    string
}

interface Props {
  items: ActionItem[]
}

// Digeneralisasi dari versi pending-only - sekarang menerima daftar
// kondisi (pending payment, member at-risk, occupancy rendah, trial
// mau habis), tapi cuma me-render yang BENAR-BENAR butuh perhatian.
// Sengaja TIDAK 4 kartu permanen yang sering kosong - itu jadi noise,
// bukan actionable (lihat KPI Trust Audit). Kalau items kosong,
// tampilkan satu status tenang, bukan halaman kosong tanpa konteks.
export function ActionSnapshot({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        </div>
        <p className="text-sm text-gray-500">Semua beres, tidak ada yang perlu ditindaklanjuti 🎉</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
      {items.map((item, i) => {
        const Icon = item.icon
        const body = (
          <>
            <div className={`w-8 h-8 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${item.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              {item.subtitle && <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>}
            </div>
            {item.href && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
          </>
        )

        return item.href ? (
          <Link key={i} href={item.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
            {body}
          </Link>
        ) : (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            {body}
          </div>
        )
      })}
    </div>
  )
}
