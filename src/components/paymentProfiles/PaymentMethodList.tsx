'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronUp, ChevronDown, X, Landmark, QrCode } from 'lucide-react'
import { AddPaymentMethodForm } from './AddPaymentMethodForm'

interface Method {
  id: string
  method_type: string
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  qris_image_url: string | null
  sort_order: number
}

interface Props {
  profileId: string
  userId: string
  initialMethods: Method[]
}

export function PaymentMethodList({ profileId, userId, initialMethods }: Props) {
  const supabase = createClient()
  const [methods, setMethods] = useState<Method[]>(
    [...initialMethods].sort((a, b) => a.sort_order - b.sort_order)
  )

  async function remove(id: string) {
    setMethods(prev => prev.filter(m => m.id !== id))
    await supabase.from('payment_methods').delete().eq('id', id)
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = methods.findIndex(m => m.id === id)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= methods.length) return

    const next = [...methods]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setMethods(next)

    await Promise.all(next.map((m, i) => supabase.from('payment_methods').update({ sort_order: i }).eq('id', m.id)))
  }

  function addMethod(method: Method) {
    setMethods(prev => [...prev, method])
  }

  return (
    <div className="space-y-3">
      {methods.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Belum ada metode pembayaran. Profile ini belum bisa dipilih di Class/Event/Package sampai ada minimal 1 metode.
        </p>
      ) : (
        <div className="space-y-2">
          {methods.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-gray-200">
                {m.method_type === 'bank'
                  ? <Landmark className="w-4 h-4 text-gray-500" />
                  : <QrCode className="w-4 h-4 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                {m.method_type === 'bank' ? (
                  <>
                    <p className="text-sm font-medium text-gray-900">{m.bank_name} - {m.account_number}</p>
                    {m.account_name && <p className="text-xs text-gray-400">{m.account_name}</p>}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.qris_image_url && <img src={m.qris_image_url} alt="QRIS" className="w-8 h-8 rounded object-cover" />}
                    <p className="text-sm font-medium text-gray-900">QRIS</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button type="button" disabled={i === 0} onClick={() => move(m.id, -1)} className="p-1 text-gray-400 disabled:opacity-30 hover:text-gray-600">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" disabled={i === methods.length - 1} onClick={() => move(m.id, 1)} className="p-1 text-gray-400 disabled:opacity-30 hover:text-gray-600">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => remove(m.id)} className="p-1 text-gray-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPaymentMethodForm
        profileId={profileId}
        userId={userId}
        nextSortOrder={methods.length}
        onAdded={addMethod}
      />
    </div>
  )
}
