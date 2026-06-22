'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { ImageLightbox } from './ImageLightbox'

interface PaymentMethod {
  id: string
  method_type: string
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  qris_image_url: string | null
}

interface Props {
  methods: PaymentMethod[]
}

export function PaymentMethodsDisplay({ methods }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [qrisOpenId, setQrisOpenId] = useState<string | null>(null)

  if (methods.length === 0) return null

  async function handleCopy(id: string, accountNumber: string) {
    try {
      await navigator.clipboard.writeText(accountNumber)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Clipboard API gagal (browser lama/izin ditolak) - nomor tetap
      // terlihat di layar untuk disalin manual.
    }
  }

  const openQris = methods.find(m => m.id === qrisOpenId)

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">Pilih Metode Pembayaran</label>
      <div className="space-y-2">
        {methods.map(m => (
          <div key={m.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50">
            {m.method_type === 'bank' ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{m.bank_name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-gray-900 font-mono tracking-wide">{m.account_number}</p>
                  {m.account_number && (
                    <button
                      type="button"
                      onClick={() => handleCopy(m.id, m.account_number!)}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                      {copiedId === m.id ? (
                        <><Check className="w-3.5 h-3.5" />Disalin</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" />Copy</>
                      )}
                    </button>
                  )}
                </div>
                {m.account_name && (
                  <p className="text-sm text-gray-600">a.n. {m.account_name}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-700">QRIS</p>
                {m.qris_image_url && (
                  <button type="button" onClick={() => setQrisOpenId(m.id)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.qris_image_url} alt="QRIS" className="w-40 h-40 object-contain" />
                  </button>
                )}
                <p className="text-xs text-gray-400">Tap untuk perbesar</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {openQris?.qris_image_url && (
        <ImageLightbox
          images={[{ url: openQris.qris_image_url, alt: 'QRIS' }]}
          initialIndex={0}
          onClose={() => setQrisOpenId(null)}
        />
      )}
    </div>
  )
}
