import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { MemberStatusBadge } from '@/components/members/MemberStatusBadge'
import { MemberEditForm } from '@/components/members/MemberEditForm'
import { MemberAvatar } from '@/components/members/MemberPhotoUpload'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Card } from '@/components/ui/card'
import { formatDate, formatRupiah } from '@/lib/utils'
import { PAYMENT_MODE } from '@/lib/constants'

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: summary }, memberRes, { data: attendance }] = await Promise.all([
    supabase
      .from('member_summary')
      .select('*')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('members') as any)
      .select('id, name, phone, notes, address, instagram, photo_url')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single() as Promise<{ data: { id: string; name: string; phone: string; notes: string | null; address?: string | null; instagram?: string | null; photo_url?: string | null } | null; error: unknown }>,
    supabase
      .from('attendance')
      .select(`
        id, payment_mode, payment_method, amount_paid, created_at,
        session:sessions(session_date, start_time, end_time,
          class:classes(name, type)
        )
      `)
      .eq('member_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const member = memberRes.data

  if (!summary || !member) notFound()

  const days = summary.last_attended_at
    ? Math.floor((Date.now() - new Date(summary.last_attended_at).getTime()) / 86_400_000)
    : null

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <MemberAvatar photoUrl={member.photo_url} name={summary.name ?? ''} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900">{summary.name}</h1>
            <MemberStatusBadge status={summary.status} />
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{summary.phone}</p>
        </div>
        <DeleteButton table="members" id={id} redirectTo="/members" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Terakhir Hadir</p>
          <p className="text-xl font-bold text-gray-900">
            {days !== null ? `${days}h` : '—'}
          </p>
          {days !== null && <p className="text-xs text-gray-400">yang lalu</p>}
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Bulan Ini</p>
          <p className="text-xl font-bold text-gray-900">{summary.attended_this_month ?? 0}</p>
          <p className="text-xs text-gray-400">kehadiran</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Hadir</p>
          <p className="text-xl font-bold text-gray-900">{summary.total_attended ?? 0}</p>
          <p className="text-xs text-gray-400">sesi</p>
        </Card>
      </div>

      {/* Edit Form */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Informasi Member</h2>
        <MemberEditForm member={member} />
      </Card>

      {/* Attendance History */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Riwayat Kehadiran
          {attendance && attendance.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({attendance.length} terakhir)
            </span>
          )}
        </h2>

        {!attendance?.length ? (
          <div className="text-center py-8">
            <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Belum ada riwayat kehadiran</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(attendance as any[]).map(a => {
              const payLabel = PAYMENT_MODE[a.payment_mode as keyof typeof PAYMENT_MODE]?.label ?? a.payment_mode
              return (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {a.session?.class?.name ?? 'Kelas'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.session?.session_date ? formatDate(a.session.session_date) : '—'}
                      {a.session?.start_time && (
                        <> · {String(a.session.start_time).substring(0, 5)}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatRupiah(Number(a.amount_paid))}
                    </p>
                    <p className="text-xs text-gray-400">{payLabel}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
