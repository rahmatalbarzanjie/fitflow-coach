'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export function CancelMembershipButton({ membershipId }: { membershipId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [confirming, setConfirming] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function cancel() {
    setLoading(true)
    setError(null)
    // RPC (bukan update langsung) - cancel_membership juga otomatis
    // mempromosikan membership 'pending' berikutnya kalau yang
    // dibatalkan ini adalah yang 'active', dalam transaksi yang sama.
    const { data: cancelled, error: err } = await supabase.rpc('cancel_membership', {
      p_membership_id: membershipId,
    })

    if (err) { setError(err.message); setLoading(false); return }
    if (!cancelled) { setError('Membership ini sudah tidak aktif.'); setLoading(false); return }
    router.refresh()
    setLoading(false)
    setConfirming(false)
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
      >
        Batalkan Paket
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Yakin batalkan?</span>
        <button
          type="button"
          onClick={cancel}
          disabled={loading}
          className="h-7 px-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          Ya, Batalkan
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition-colors"
        >
          Batal
        </button>
      </div>
    </div>
  )
}
