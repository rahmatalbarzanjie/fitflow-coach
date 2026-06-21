import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Users, MessageCircle } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { TrialManager } from '@/components/admin/TrialManager'

export default async function AdminInstructorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user?.email !== adminEmail) notFound()

  const serviceSupabase = createServiceClient()
  const { data: profilesRaw } = await serviceSupabase
    .from('profiles')
    .select('*')
    .neq('id', user!.id)
    .order('created_at', { ascending: false })

  const profiles = (profilesRaw ?? []) as any[]
  const now = new Date()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-gray-700" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Instruktur</h1>
          <p className="text-sm text-gray-400">{profiles.length} instruktur terdaftar</p>
        </div>
      </div>

      <Card>
        <div className="space-y-3">
          {!profiles.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada instruktur terdaftar.</p>
          ) : profiles.map(p => {
            const trialExpired = p.trial_expires_at && new Date(p.trial_expires_at) < now
            const trialDaysLeft = p.trial_expires_at
              ? Math.max(0, Math.ceil((new Date(p.trial_expires_at).getTime() - now.getTime()) / 86_400_000))
              : null
            const status = p.subscription_status ?? 'trial'
            // Token doang BUKAN bukti connected - device bisa dihapus/disconnect
            // di Fonnte tanpa token kita ikut terhapus. bot_phone cuma keisi
            // kalau koneksi pernah benar-benar berhasil.
            const botConnected = !!(p.fonnte_token && String(p.fonnte_token).trim().length > 10 && p.bot_phone)

            return (
              <div key={p.id} className="flex items-start justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{p.business_name ?? p.name}</p>
                    {p.slug && (
                      <span className="text-xs text-gray-400 font-mono">/{p.slug}</span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      status === 'active'  ? 'bg-green-100 text-green-700' :
                      trialExpired        ? 'bg-red-100 text-red-600'    :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {status === 'active' ? 'Aktif' : trialExpired ? 'Habis' : `Trial${trialDaysLeft !== null ? ` · ${trialDaysLeft}h` : ''}`}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      botConnected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <MessageCircle className="w-2.5 h-2.5" />
                      {botConnected ? 'Bot WA ✓' : 'Bot WA belum setup'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.phone ?? '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Daftar: {formatDateShort(p.created_at ?? new Date().toISOString())}
                    {p.trial_expires_at && ` · Trial s/d ${formatDateShort(p.trial_expires_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Link
                    href={`/admin/${p.id}`}
                    className="text-xs text-gray-400 hover:text-violet-600 transition-colors"
                  >
                    Detail →
                  </Link>
                  <TrialManager
                    profileId={p.id}
                    currentStatus={status}
                    trialExpiresAt={p.trial_expires_at ?? null}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
