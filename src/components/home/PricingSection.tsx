'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, MessageCircle } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

const PLANS = [
  {
    key:       'starter',
    name:      'Starter',
    monthly:   99_000,
    badge:     null,
    quotaItems: ['3 kelas aktif', '150 broadcast WA/bulan'],
  },
  {
    key:       'pro',
    name:      'Pro',
    monthly:   199_000,
    badge:     'Paling Populer',
    quotaItems: ['10 kelas aktif', '600 broadcast WA/bulan'],
  },
  {
    key:       'studio',
    name:      'Studio',
    monthly:   349_000,
    badge:     null,
    quotaItems: ['Kelas aktif unlimited', 'Broadcast WA unlimited'],
  },
] as const

const DURATIONS = [
  { months: 1,  label: '1 Bulan' },
  { months: 3,  label: '3 Bulan' },
  { months: 6,  label: '6 Bulan' },
  { months: 12, label: '1 Tahun' },
] as const

function calcPrice(monthly: number, months: number) {
  if (months === 12) {
    const total = monthly * 10 // bayar 10 bulan, gratis 2
    return { perMonth: Math.round(total / 12), total, normalTotal: monthly * 12 }
  }
  const discount = months === 6 ? 0.15 : months === 3 ? 0.10 : 0
  const perMonth = Math.round(monthly * (1 - discount))
  return { perMonth, total: perMonth * months, normalTotal: monthly * months }
}

export function PricingSection() {
  const [months, setMonths] = useState<1 | 3 | 6 | 12>(1)
  const adminWA = process.env.NEXT_PUBLIC_ADMIN_WA ?? ''

  return (
    <section className="py-16" id="pricing">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Harga Transparan, Tanpa Kejutan</h2>
        <p className="text-gray-500 text-center text-sm mb-3">Trial 30 hari akses penuh dulu, baru pilih paket yang cocok.</p>

        {/* Promo banner */}
        <div className="max-w-md mx-auto mb-8 text-center">
          <span className="inline-block text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full">
            🔥 Promo Peluncuran — Diskon tambahan 20% untuk 30 instruktur pertama
          </span>
        </div>

        {/* Duration toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {DURATIONS.map(d => (
              <button
                key={d.months}
                onClick={() => setMonths(d.months)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  months === d.months ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d.label}
                {d.months === 12 && <span className="ml-1 text-[10px] text-green-600 font-bold">Hemat!</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const price = calcPrice(plan.monthly, months)
            const hasDiscount = price.total < price.normalTotal
            const waMsg = encodeURIComponent(`Halo! Saya tertarik paket ${plan.name} (${months} bulan) FitFlow Coach. Boleh tanya-tanya dulu?`)
            const waLink = adminWA ? `https://wa.me/${adminWA.replace(/\D/g, '')}?text=${waMsg}` : null

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border-2 p-6 hover-lift transition-all ${
                  plan.badge ? 'border-violet-500 shadow-lg shadow-violet-100' : 'border-gray-200'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold bg-violet-600 text-white px-3 py-0.5 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                )}
                <h3 className="font-bold text-gray-900 mb-1">{plan.name}</h3>

                <div className="mb-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-gray-900">{formatRupiah(price.perMonth)}</span>
                    <span className="text-xs text-gray-400">/bulan</span>
                  </div>
                  {hasDiscount && (
                    <p className="text-xs text-gray-400">
                      <span className="line-through">{formatRupiah(plan.monthly)}/bulan</span>
                      {' '}<span className="text-green-600 font-semibold">Hemat {Math.round((1 - price.total / price.normalTotal) * 100)}%</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Total {formatRupiah(price.total)} {months > 1 && `untuk ${months} bulan`}
                    {months === 12 && <span className="text-green-600 font-medium"> (bayar 10, gratis 2!)</span>}
                  </p>
                </div>

                <p className="text-xs font-medium text-violet-600 bg-violet-50 rounded-lg px-2.5 py-1.5 mb-4 mt-3">
                  ✨ Semua paket dapat AI Caption Generator & AI Bot WA
                </p>

                <ul className="space-y-2 mb-5">
                  {plan.quotaItems.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                  {['Unlimited member', 'Absensi digital', 'Notifikasi WA', 'Manajemen event & pendaftaran', 'Laporan & bagi hasil'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/daftar"
                  className={`block text-center h-10 leading-10 rounded-xl text-sm font-semibold transition-colors mb-2 ${
                    plan.badge
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  Pilih Paket Ini
                </Link>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-violet-600 transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" />
                    Tanya dulu via WhatsApp
                  </a>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Harga belum termasuk PPN. Pembayaran manual via transfer, dicatat tim kami. Tidak ada kontrak jangka panjang — bisa ganti paket kapan saja.
        </p>
      </div>
    </section>
  )
}
