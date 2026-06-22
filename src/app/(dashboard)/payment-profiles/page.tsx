import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Wallet } from 'lucide-react'

export default async function PaymentProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profilesRes, methodsRes] = await Promise.all([
    supabase
      .from('payment_profiles')
      .select('id, name, is_active')
      .eq('user_id', user!.id)
      .order('is_active', { ascending: false })
      .order('name'),
    supabase
      .from('payment_methods')
      .select('payment_profile_id')
      .eq('user_id', user!.id),
  ])

  const profiles = (profilesRes.data ?? []) as any[]
  const methodCounts: Record<string, number> = {}
  ;((methodsRes.data ?? []) as any[]).forEach(m => {
    methodCounts[m.payment_profile_id] = (methodCounts[m.payment_profile_id] ?? 0) + 1
  })

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payment Profiles</h1>
          <p className="text-sm text-gray-400 mt-0.5">{profiles.length} tujuan pembayaran</p>
        </div>
        <Link
          href="/payment-profiles/new"
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </Link>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Wallet className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            Belum ada Payment Profile. Buat satu untuk mulai dipilih di Class/Event/Membership Package.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {profiles.map(p => {
            const count = methodCounts[p.id] ?? 0
            return (
              <Link
                key={p.id}
                href={`/payment-profiles/${p.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    {!p.is_active && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Nonaktif</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {count === 0 ? 'Belum ada metode pembayaran' : `${count} metode pembayaran`}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
