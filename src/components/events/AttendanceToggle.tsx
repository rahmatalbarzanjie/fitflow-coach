'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface Props {
  registrationId: string
  attended: boolean
}

export function AttendanceToggle({ registrationId, attended }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await supabase
      .from('registrations')
      .update({ attended: !attended })
      .eq('id', registrationId)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
        attended ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
      }`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : attended ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <Circle className="w-3 h-3" />
      )}
      {attended ? 'Hadir' : 'Tandai Hadir'}
    </button>
  )
}
