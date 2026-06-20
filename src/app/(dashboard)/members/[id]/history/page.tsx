import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Calendar } from 'lucide-react'
import { formatDate, formatRupiah } from '@/lib/utils'
import { PAYMENT_MODE } from '@/lib/constants'

export default async function MemberHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [memberRes, attendanceRes] = await Promise.all([
    (supabase.from('members') as any)
      .select('id, name')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single(),

    supabase
      .from('attendance')
      .select(`
        id, payment_mode, payment_method, amount_paid, created_at,
        session:sessions(
          session_date, start_time, end_time,
          class:classes(name, type)
        )
      `)
      .eq('member_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const member     = memberRes.data
  if (!member) notFound()

  const attendance = (attendanceRes.data ?? []) as any[]

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref={`/members/${id}`}
        title="Riwayat Kehadiran"
        subtitle={member.name}
      />

      {!attendance.length ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Belum ada riwayat kehadiran</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs text-gray-400">{attendance.length} sesi tercatat</p>
          </div>
          <div className="divide-y divide-gray-50">
            {attendance.map(a => {
              const payLabel = PAYMENT_MODE[a.payment_mode as keyof typeof PAYMENT_MODE]?.label ?? a.payment_mode
              const className  = a.session?.class?.name ?? 'Kelas'
              const sessionDate = a.session?.session_date
              const startTime  = a.session?.start_time
                ? String(a.session.start_time).substring(0, 5)
                : null

              return (
                <div key={a.id} className="flex items-center justify-between px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{className}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sessionDate ? formatDate(sessionDate) : '-'}
                      {startTime && <span> · {startTime}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatRupiah(Number(a.amount_paid))}
                    </p>
                    <p className="text-xs text-gray-400">{payLabel}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
