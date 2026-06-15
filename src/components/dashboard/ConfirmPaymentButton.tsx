'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

export function ConfirmPaymentButton({ registrationId }: { registrationId: string }) {
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function confirm() {
    setLoading(true)
    await supabase
      .from('registrations')
      .update({ payment_status: 'confirmed' })
      .eq('id', registrationId)
    setDone(true)
    setLoading(false)
    setTimeout(() => router.refresh(), 500)
  }

  if (done) return (
    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
      <Check className="w-3 h-3" /> Terkonfirmasi
    </span>
  )

  return (
    <button
      onClick={confirm}
      disabled={loading}
      className="flex items-center gap-1 h-7 px-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      Konfirmasi
    </button>
  )
}
