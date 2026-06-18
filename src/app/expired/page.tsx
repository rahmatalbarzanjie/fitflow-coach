import Link from 'next/link'
import { Activity, Clock, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/settings/LogoutButton'
import { getSystemConfig } from '@/lib/system-config'

export default async function ExpiredPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminWA  = (await getSystemConfig('admin_wa')) || process.env.NEXT_PUBLIC_ADMIN_WA || ''
  const adminMsg = encodeURIComponent(`Halo! Masa trial FitFlow Coach saya sudah habis. Mohon perpanjangan untuk akun ${user?.email ?? ''}`)
  const waLink   = adminWA ? `https://wa.me/${adminWA.replace(/\D/g, '')}?text=${adminMsg}` : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-2xl mb-5">
          <Clock className="w-8 h-8 text-orange-500" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 bg-violet-600 rounded-lg flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900">FitFlow Coach</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Masa Trial Telah Berakhir</h1>
        <p className="text-sm text-gray-500 mb-6">
          Masa trial 30 hari kamu sudah habis. Hubungi admin untuk melanjutkan langganan dan kembali akses dashboard kamu.
        </p>

        <div className="space-y-3">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Hubungi Admin via WhatsApp
            </a>
          )}

          <div className="pt-2">
            <LogoutButton />
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Login sebagai akun lain?{' '}
          <Link href="/login" className="text-violet-600 hover:underline">Masuk di sini</Link>
        </p>
      </div>
    </div>
  )
}
