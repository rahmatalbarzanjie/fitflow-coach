import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { CancelMembershipButton } from '@/components/members/CancelMembershipButton'
import { formatDateShort, formatRupiah } from '@/lib/utils'
import { Plus, Package as PackageIcon } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  active:    'Aktif',
  pending:   'Menunggu',
  expired:   'Berakhir',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-50 text-green-600',
  pending:   'bg-blue-50 text-blue-600',
  expired:   'bg-gray-100 text-gray-400',
  completed: 'bg-gray-100 text-gray-400',
  cancelled: 'bg-red-50 text-red-500',
}

export default async function MemberMembershipPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [memberRes, membershipsRes] = await Promise.all([
    supabase.from('members').select('id, name').eq('id', id).eq('user_id', user!.id).single(),
    supabase
      .from('member_memberships')
      .select('id, package_name, package_type, start_date, end_date, total_sessions, used_sessions, purchase_price, status, created_at')
      .eq('member_id', id)
      .order('created_at', { ascending: false }),
  ])

  const member = memberRes.data
  if (!member) notFound()

  const all      = (membershipsRes.data ?? []) as any[]
  const active   = all.find(m => m.status === 'active') ?? null
  const pending  = all.filter(m => m.status === 'pending')
  const history  = all.filter(m => m.status !== 'active' && m.status !== 'pending')

  function describePackage(m: any) {
    return m.package_type === 'unlimited'
      ? `Aktif sampai ${formatDateShort(m.end_date)}`
      : `Sisa ${(m.total_sessions ?? 0) - (m.used_sessions ?? 0)} / ${m.total_sessions} sesi`
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref={`/members/${id}`} title="Membership" subtitle={member.name} />

      {/* Paket Aktif */}
      <SectionList label="Paket Aktif">
        {active ? (
          <div className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{active.package_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{describePackage(active)}</p>
            </div>
            <CancelMembershipButton membershipId={active.id} />
          </div>
        ) : (
          <div className="p-6 text-center">
            <PackageIcon className="w-6 h-6 text-gray-200 mx-auto mb-1.5" />
            <p className="text-sm text-gray-400">Belum ada paket aktif</p>
          </div>
        )}
      </SectionList>

      <Link
        href={`/members/${id}/membership/assign`}
        className="flex items-center justify-center gap-1.5 h-10 mb-4 border border-violet-200 text-violet-600 hover:bg-violet-50 rounded-xl text-sm font-semibold transition-colors"
      >
        <Plus className="w-4 h-4" />
        Assign Paket {active ? '(Antrian Berikutnya)' : ''}
      </Link>

      {/* Antrian (pending) */}
      {pending.length > 0 && (
        <SectionList label="Akan Aktif">
          {pending.map(m => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{m.package_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Mulai {formatDateShort(m.start_date)}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR.pending}`}>
                {STATUS_LABEL.pending}
              </span>
            </div>
          ))}
        </SectionList>
      )}

      {/* Riwayat */}
      <SectionList label="Riwayat Paket">
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Belum ada riwayat paket sebelumnya</p>
        ) : (
          history.map(m => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{m.package_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDateShort(m.start_date)}{m.end_date ? ` - ${formatDateShort(m.end_date)}` : ''}
                  {Number(m.purchase_price) > 0 ? ` · ${formatRupiah(Number(m.purchase_price))}` : ''}
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${STATUS_COLOR[m.status] ?? 'bg-gray-100 text-gray-400'}`}>
                {STATUS_LABEL[m.status] ?? m.status}
              </span>
            </div>
          ))
        )}
      </SectionList>
    </div>
  )
}
