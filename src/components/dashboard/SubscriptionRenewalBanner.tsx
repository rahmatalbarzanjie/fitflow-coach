'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Clock } from 'lucide-react'

export interface SubscriptionRenewalBannerProps {
  daysLeft: number
  renewalDate: Date
  planName: string
  onDismiss?: () => void
}

const SESSION_KEY = 'fuelos_renewal_dismissed'

export function SubscriptionRenewalBanner({
  daysLeft,
  renewalDate,
  planName,
}: SubscriptionRenewalBannerProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // sessionStorage hanya tersedia di client — mount guard cukup, tidak perlu
    // suppressHydrationWarning karena komponen ini tidak pernah di-SSR sama sekali
    // (parent selalu passing data, tapi visibility ditentukan setelah mount).
    if (daysLeft > 7) return
    if (sessionStorage.getItem(SESSION_KEY)) return
    setVisible(true)
  }, [daysLeft])

  if (!visible) return null

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setVisible(false)
  }

  const renewalLabel = renewalDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })

  const isUrgent = daysLeft <= 3

  return (
    <div
      role="alert"
      className={`
        flex items-center gap-3 px-4 py-2.5 text-sm rounded-2xl mb-4 border
        ${isUrgent
          ? 'bg-red-50 border-red-100 text-red-800'
          : 'bg-amber-50 border-amber-100 text-amber-800'}
      `}
    >
      {/* Icon */}
      <Clock
        className={`w-4 h-4 shrink-0 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <span className="font-semibold">
          {daysLeft === 0 ? 'Berakhir hari ini' : `${daysLeft} hari lagi`}
        </span>
        <span className="mx-1.5 opacity-50">·</span>
        <span className="opacity-75">
          {planName} berakhir {daysLeft === 0 ? '' : 'pada'} {renewalLabel}
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push('/settings/subscription')}
        className={`
          shrink-0 hidden sm:flex items-center h-7 px-3 rounded-lg text-xs font-semibold
          transition-colors whitespace-nowrap
          ${isUrgent
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-white'}
        `}
      >
        Perpanjang Sekarang
      </button>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        aria-label="Tutup notifikasi"
        className={`
          shrink-0 p-1 rounded-lg transition-colors
          ${isUrgent
            ? 'text-red-400 hover:bg-red-100'
            : 'text-amber-400 hover:bg-amber-100'}
        `}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
