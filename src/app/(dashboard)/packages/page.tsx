import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Package as PackageIcon } from 'lucide-react'
import { CLASS_TYPES } from '@/lib/constants'
import { formatRupiah } from '@/lib/utils'

export default async function PackagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: packages } = await supabase
    .from('membership_packages')
    .select('id, name, package_type, class_type, total_sessions, duration_days, price, is_active')
    .eq('user_id', user!.id)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  const all = (packages ?? []) as any[]
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Packages</h1>
          <p className="text-sm text-gray-400 mt-0.5">{all.length} paket membership</p>
        </div>
        <Link
          href="/packages/new"
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <PackageIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Belum ada paket membership. Buat paket pertama untuk mulai assign ke member.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {all.map(p => (
            <Link
              key={p.id}
              href={`/packages/${p.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  {!p.is_active && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                      Nonaktif
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.package_type === 'unlimited' ? 'Unlimited' : `${p.total_sessions}x Sesi`}
                  {p.class_type ? ` · ${typeLabel[p.class_type] ?? p.class_type}` : ' · Semua kelas'}
                  {p.duration_days ? ` · ${p.duration_days} hari` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-violet-600 shrink-0 ml-3">
                {formatRupiah(Number(p.price))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
