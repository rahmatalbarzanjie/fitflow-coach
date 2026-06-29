import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { CancelMembershipButton } from '@/components/members/CancelMembershipButton'
import { RefundMembershipButton } from '@/components/members/RefundMembershipButton'
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
      .select('id, package_name, package_type, start_date, end_date, total_sessions, purchase_price, status, created_at, source, refund_amount, refund_reason, refunded_at')
      .eq('member_id', id)
      .order('created_at', { ascending: false }),
  ])

  const member = memberRes.data
  if (!member) notFound()

  const all      = (membershipsRes.data ?? []) as any[]
  const active   = all.find(m => m.status === 'active') ?? null
  const pending  = all.filter(m => m.status === 'pending')
  const history  = all.filter(m => m.status !== 'active' && m.status !== 'pending')

  // Sisa sesi SELALU dihitung dari ledger konsumsi, TIDAK PERNAH dari kolom
  // tersimpan (kolom used_sessions sudah dihapus - lihat
  // docs/MEMBERSHIP_LIFECYCLE_ENGINE_DESIGN.md §B). Cuma perlu dihitung
  // untuk paket aktif yang session_pack - unlimited tidak ada konsep sisa.
  let activeUsedSessions = 0
  if (active && active.package_type === 'session_pack') {
    const { count } = await supabase
      .from('membership_consumptions')
      .select('id', { count: 'exact', head: true })
      .eq('membership_id', active.id)
      .is('reversed_at', null)
    activeUsedSessions = count ?? 0
  }

  function describePackage(m: any) {
    return m.package_type === 'unlimited'
      ? `Aktif sampai ${formatDateShort(m.end_date)}`
      : `Sisa ${(m.total_sessions ?? 0) - activeUsedSessions} / ${m.total_sessions} sesi`
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref={`/members/${id}`} title="Membership" subtitle={member.name} />

      {/* Paket Aktif */}
      <SectionList label="Paket Aktif">
        {active ? (
          <div className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900">{active.package_name}</p>
                {active.source === 'legacy' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">Legacy</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{describePackage(active)}</p>
            </div>
            <div className="flex items-center gap-3">
              <RefundMembershipButton membershipId={active.id} purchasePrice={Number(active.purchase_price) || 0} />
              <CancelMembershipButton membershipId={active.id} />
            </div>
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
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <RefundMembershipButton membershipId={m.id} purchasePrice={Number(m.purchase_price) || 0} />
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR.pending}`}>
                  {STATUS_LABEL.pending}
                </span>
              </div>
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
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-900">{m.package_name}</p>
                  {m.source === 'legacy' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">Legacy</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDateShort(m.start_date)}{m.end_date ? ` - ${formatDateShort(m.end_date)}` : ''}
                  {Number(m.purchase_price) > 0 ? ` · ${formatRupiah(Number(m.purchase_price))}` : ''}
                </p>
                {m.refunded_at && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Refund {formatRupiah(Number(m.refund_amount))} · {formatDateShort(m.refunded_at)}
                    {m.refund_reason ? ` · "${m.refund_reason}"` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                {!m.refunded_at && Number(m.purchase_price) > 0 && (
                  <RefundMembershipButton membershipId={m.id} purchasePrice={Number(m.purchase_price) || 0} />
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[m.status] ?? 'bg-gray-100 text-gray-400'}`}>
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </div>
            </div>
          ))
        )}
      </SectionList>
    </div>
  )
}
