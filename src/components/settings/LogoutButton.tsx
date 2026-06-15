'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Loader2 } from 'lucide-react'

export function LogoutButton() {
  const [loading, setLoading] = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function logout() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 h-11 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 rounded-xl text-sm font-medium transition-colors"
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <LogOut className="w-4 h-4" />
      }
      {loading ? 'Keluar...' : 'Keluar dari Akun'}
    </button>
  )
}
