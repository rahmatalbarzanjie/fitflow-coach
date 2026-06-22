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
  const [selectedId, setSelectedId] = useState<string | null>(methods[0]?.id ?? null)

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

  // Profile ter-link tapi semua method-nya sudah dihapus instruktur -
  // jangan diam-diam sembunyikan section ini, peserta bisa kebingungan
  // diminta upload bukti transfer tanpa pernah tahu mau transfer ke mana.
  if (methods.length === 0) {
    return (
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
        Belum ada metode pembayaran tersedia. Hubungi instruktur langsung untuk info pembayaran.
      </div>
    )
  }

  const selected = methods.find(m => m.id === selectedId) ?? methods[0]
  const openQris = methods.find(m => m.id === qrisOpenId)

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">Pilih Metode Pembayaran</label>

      {/* Segmented selector - cuma render kalau >1 method. Urutan ikut
          sort_order instruktur, tidak ada method yang ditandai
          "rekomendasi" - yang terpilih pertama cuma kebetulan urutan
          pertama, bukan keputusan sistem. */}
      {methods.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {methods.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                selected.id === m.id
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {m.method_type === 'bank' ? m.bank_name : 'QRIS'}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
        {selected.method_type === 'bank' ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{selected.bank_name}</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-gray-900 font-mono tracking-wide">{selected.account_number}</p>
              {selected.account_number && (
                <button
                  type="button"
                  onClick={() => handleCopy(selected.id, selected.account_number!)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-violet-600 hover:bg-violet-50 transition-colors"
                >
                  {copiedId === selected.id ? (
                    <><Check className="w-3.5 h-3.5" />Disalin</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" />Copy</>
                  )}
                </button>
              )}
            </div>
            {selected.account_name && (
              <p className="text-sm text-gray-600">a.n. {selected.account_name}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-700">QRIS</p>
            {selected.qris_image_url && (
              <button type="button" onClick={() => setQrisOpenId(selected.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.qris_image_url} alt="QRIS" className="w-40 h-40 object-contain" />
              </button>
            )}
            <p className="text-xs text-gray-400">Tap untuk perbesar</p>
          </div>
        )}
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
