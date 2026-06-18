'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

export function ApproveTestimonialButton({ testimonialId }: { testimonialId: string }) {
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function approve() {
    setLoading(true)
    await supabase
      .from('testimonials')
      .update({ is_published: true })
      .eq('id', testimonialId)
    setDone(true)
    setLoading(false)
    setTimeout(() => router.refresh(), 500)
  }

  if (done) return (
    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
      <Check className="w-3 h-3" /> Disetujui
    </span>
  )

  return (
    <button
      onClick={approve}
      disabled={loading}
      className="flex items-center gap-1 h-7 px-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      Setujui
    </button>
  )
}
