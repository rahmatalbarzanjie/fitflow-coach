import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { checkClassQuota } from '@/lib/quota'
import { NewClassForm } from '@/components/classes/NewClassForm'
import { getSystemConfig } from '@/lib/system-config'

export default async function NewClassPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const quota = await checkClassQuota(supabase, user!.id)

  if (!quota.ok) {
    const adminWA  = (await getSystemConfig('admin_wa')) || process.env.NEXT_PUBLIC_ADMIN_WA || ''
    const waMsg    = encodeURIComponent(`Halo! Kuota kelas aktif saya sudah penuh (${quota.used}/${quota.limit}). Saya mau upgrade paket.`)
    const waLink   = adminWA ? `https://wa.me/${adminWA.replace(/\D/g, '')}?text=${waMsg}` : null

    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/classes" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Tambah Kelas</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-orange-500" />
          </div>
          <p className="text-base font-semibold text-gray-900 mb-1">
            Kuota kelas aktif sudah penuh ({quota.used}/{quota.limit})
          </p>
          <p className="text-sm text-gray-400 mb-5">
            Upgrade paket untuk menambah kelas aktif lebih banyak.
          </p>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-10 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Upgrade Paket via WhatsApp
            </a>
          )}
        </div>
      </div>
    )
  }

  return <NewClassForm />
}
