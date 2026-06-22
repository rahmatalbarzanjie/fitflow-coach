import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { formatRupiah } from '@/lib/utils'
import { Zap, Calendar, Package, UserPlus } from 'lucide-react'

// Revenue = uang yang PERNAH dikonfirmasi diterima (fakta historis),
// bukan status saat ini - registrasi yang confirmed lalu dibatalkan
// tetap dihitung revenue bulan saat dikonfirmasi. Lihat audit Revenue
// Settlement: confirmed_at IS NOT NULL, bukan payment_status='confirmed'.
//
// Tidak menyentuh get_dashboard_summary()/widget Revenue di Beranda -
// itu definisi lama, keputusan ganti/tetap/relabel sengaja dipisah jadi
// audit terpisah, tidak digabung ke halaman ini.

function getMonthStartWIB(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export default async function LaporanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const monthStart = getMonthStartWIB()

  // event_registration_summary & class_registration_summary tidak expose
  // kolom user_id - scoping ke instruktur sendiri otomatis lewat RLS pada
  // tabel dasarnya (sama seperti classes/[id]/registrations/page.tsx).
  const [eventRegsRes, classRegsRes, membershipsRes, walkinsRes] = await Promise.all([
    supabase
      .from('event_registration_summary')
      .select('event_id, event_title, amount_paid')
      .not('confirmed_at', 'is', null)
      .gte('confirmed_at', monthStart),
    supabase
      .from('class_registration_summary')
      .select('class_id, class_name, amount_paid')
      .not('confirmed_at', 'is', null)
      .gte('confirmed_at', monthStart),
    supabase
      .from('member_memberships')
      .select('purchase_price')
      .eq('user_id', user!.id)
      .gt('purchase_price', 0)
      .gte('created_at', monthStart),
    supabase
      .from('attendance')
      .select('amount_paid')
      .eq('user_id', user!.id)
      .eq('source', 'walkin')
      .gte('created_at', monthStart),
  ])

  const eventRegs    = (eventRegsRes.data ?? []) as { event_id: string; event_title: string; amount_paid: number }[]
  const classRegs    = (classRegsRes.data ?? []) as { class_id: string; class_name: string; amount_paid: number }[]
  const memberships  = (membershipsRes.data ?? []) as { purchase_price: number }[]
  const walkins      = (walkinsRes.data ?? []) as { amount_paid: number }[]

  const sum = (rows: { amount_paid?: number; purchase_price?: number }[], key: 'amount_paid' | 'purchase_price') =>
    rows.reduce((s, r) => s + Number(r[key] ?? 0), 0)

  const eventRevenue      = sum(eventRegs, 'amount_paid')
  const classRevenue      = sum(classRegs, 'amount_paid')
  const membershipRevenue = sum(memberships, 'purchase_price')
  const walkinRevenue     = sum(walkins, 'amount_paid')
  const totalRevenue      = eventRevenue + classRevenue + membershipRevenue + walkinRevenue

  function topN<T extends { amount_paid: number }>(rows: T[], idKey: keyof T, nameKey: keyof T, n: number) {
    const grouped = new Map<string, { name: string; total: number }>()
    rows.forEach(r => {
      const id = String(r[idKey])
      const name = String(r[nameKey])
      const existing = grouped.get(id)
      grouped.set(id, { name, total: (existing?.total ?? 0) + Number(r.amount_paid) })
    })
    return [...grouped.values()].sort((a, b) => b.total - a.total).slice(0, n)
  }

  const topEvents  = topN(eventRegs, 'event_id', 'event_title', 5)
  const topClasses = topN(classRegs, 'class_id', 'class_name', 5)

  const breakdown = [
    { label: 'Event',      value: eventRevenue,      icon: Zap },
    { label: 'Kelas',      value: classRevenue,      icon: Calendar },
    { label: 'Membership', value: membershipRevenue, icon: Package },
    { label: 'Walk-in',    value: walkinRevenue,     icon: UserPlus },
  ]

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader title="Laporan" subtitle="Revenue bulan ini" />

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 text-center">
        <p className="text-xs text-gray-400 mb-1">Revenue Bulan Ini</p>
        <p className="text-3xl font-bold text-violet-600">{formatRupiah(totalRevenue)}</p>
      </div>

      <SectionList label="Sumber Revenue">
        {breakdown.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{label}</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{formatRupiah(value)}</span>
          </div>
        ))}
      </SectionList>

      {topEvents.length > 0 && (
        <SectionList label="Top Event">
          {topEvents.map(e => (
            <div key={e.name} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700 truncate">{e.name}</span>
              <span className="text-sm font-semibold text-gray-900 shrink-0 ml-3">{formatRupiah(e.total)}</span>
            </div>
          ))}
        </SectionList>
      )}

      {topClasses.length > 0 && (
        <SectionList label="Top Kelas">
          {topClasses.map(c => (
            <div key={c.name} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700 truncate">{c.name}</span>
              <span className="text-sm font-semibold text-gray-900 shrink-0 ml-3">{formatRupiah(c.total)}</span>
            </div>
          ))}
        </SectionList>
      )}

      {totalRevenue === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">Belum ada revenue bulan ini.</p>
      )}
    </div>
  )
}
