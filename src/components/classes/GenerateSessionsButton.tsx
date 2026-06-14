'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  classId: string
  variant?: 'default' | 'primary'
}

export function GenerateSessionsButton({ classId, variant = 'default' }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function generate() {
    setLoading(true)
    await supabase.rpc('generate_sessions_for_class', {
      p_class_id: classId,
      p_days: 56,
    })
    setLoading(false)
    setDone(true)
    router.refresh()
    setTimeout(() => setDone(false), 3000)
  }

  if (variant === 'primary') {
    return (
      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 h-8 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        {loading ? 'Membuat...' : 'Generate Sesi 8 Minggu'}
      </button>
    )
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="flex items-center gap-1 h-7 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
      {done ? 'Dibuat ✓' : loading ? 'Membuat...' : 'Generate Sesi'}
    </button>
  )
}
