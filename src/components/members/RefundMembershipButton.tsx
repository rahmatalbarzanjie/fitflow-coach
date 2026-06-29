'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const inputClass = 'w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

interface Props {
  membershipId: string
  purchasePrice: number
}

export function RefundMembershipButton({ membershipId, purchasePrice }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open,    setOpen]    = useState(false)
  const [amount,  setAmount]  = useState(purchasePrice)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function submit() {
    if (amount <= 0 || amount > purchasePrice) {
      setError(`Jumlah refund harus antara Rp 1 dan ${formatRupiah(purchasePrice)}.`)
      return
    }
    setLoading(true)
    setError(null)
    // RPC - kalau membership ini masih 'active'/'pending', otomatis ikut
    // dibatalkan (dan promosi pending berikutnya kalau yang di-refund
    // adalah yang 'active') supaya tidak ada celah "sudah di-refund
    // tapi masih bisa dipakai".
    const { error: err } = await supabase.rpc('refund_membership', {
      p_membership_id: membershipId,
      p_refund_amount: amount,
      p_refund_reason: reason.trim() || undefined,
    })

    if (err) {
      setError(
        err.message === 'already_refunded'
          ? 'Membership ini sudah pernah di-refund sebelumnya.'
          : err.message === 'invalid_refund_amount'
            ? 'Jumlah refund tidak valid.'
            : 'Gagal memproses refund. Coba lagi.'
      )
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
      >
        Refund
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5 w-48">
      {error && <p className="text-xs text-red-600 text-left">{error}</p>}
      <input
        type="number"
        min="1"
        max={purchasePrice}
        value={amount}
        onChange={e => setAmount(Number(e.target.value))}
        className={inputClass}
        placeholder="Jumlah refund (Rp)"
      />
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        className={inputClass}
        placeholder="Alasan (opsional)"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="h-7 px-2.5 bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          Proses Refund
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition-colors"
        >
          Batal
        </button>
      </div>
    </div>
  )
}
