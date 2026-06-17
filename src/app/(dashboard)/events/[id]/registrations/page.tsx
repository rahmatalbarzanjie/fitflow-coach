import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, ExternalLink, MessageSquareWarning } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { RegistrationActions } from '@/components/events/RegistrationActions'
import { AttendanceToggle } from '@/components/events/AttendanceToggle'
import { FeedbackRequestButtonEvent } from '@/components/events/FeedbackRequestButtonEvent'
import { formatDateShort, formatRupiah } from '@/lib/utils'
import { PAYMENT_STATUS, REGISTRATION_TIER } from '@/lib/constants'

const STATUS_COLOR: Record<string, 'yellow' | 'green' | 'red'> = {
  pending:   'yellow',
  confirmed: 'green',
  rejected:  'red',
}

const STATUS_TABS = [
  { key: '',          label: 'Semua'    },
  { key: 'pending',   label: 'Menunggu' },
  { key: 'confirmed', label: 'Konfirmasi' },
  { key: 'rejected',  label: 'Ditolak'  },
]

export default async function RegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const { id }           = await params
  const { status = '' }  = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: ev } = await supabase
    .from('events')
    .select('id, title, event_date, status')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!ev) notFound()

  let regQuery = supabase
    .from('event_registration_summary')
    .select('*')
    .eq('event_id', id)
    .order('registered_at', { ascending: false })

  if (status) {
    regQuery = regQuery.eq('payment_status', status as any)
  }

  const { data: registrations } = await regQuery

  const { data: feedbackList } = await supabase
    .from('session_feedback')
    .select('id, content, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  const total     = registrations?.length ?? 0
  const pending   = registrations?.filter(r => r.payment_status === 'pending').length ?? 0
  const confirmed = registrations?.filter(r => r.payment_status === 'confirmed').length ?? 0
  const attended  = registrations?.filter(r => r.attended).length ?? 0

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/events/${id}`} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{ev.title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDateShort(ev.event_date)} · {total} peserta · {confirmed} terkonfirmasi · {attended} dari {total} hadir
          </p>
        </div>
        {attended > 0 && <FeedbackRequestButtonEvent eventId={id} />}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(tab => (
          <Link
            key={tab.key}
            href={tab.key ? `/events/${id}/registrations?status=${tab.key}` : `/events/${id}/registrations`}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              status === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.key === 'pending' && pending > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs px-1.5 rounded-full">{pending}</span>
            )}
          </Link>
        ))}
      </div>

      {!registrations?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Belum ada peserta{status ? ` dengan status ini` : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {(registrations as any[]).map(r => (
              <div key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{r.registrant_name}</p>
                      <Badge color={STATUS_COLOR[r.payment_status] ?? 'gray'}>
                        {PAYMENT_STATUS[r.payment_status as keyof typeof PAYMENT_STATUS]?.label ?? r.payment_status}
                      </Badge>
                      <Badge color="gray">
                        {REGISTRATION_TIER[r.tier as keyof typeof REGISTRATION_TIER]?.label ?? r.tier}
                      </Badge>
                      {r.is_member && <Badge color="violet">Member</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {r.registrant_phone}
                      <span className="mx-2">·</span>
                      {formatRupiah(Number(r.amount_paid))}
                      <span className="mx-2">·</span>
                      {formatDateShort(r.registered_at)}
                    </p>

                    {/* Rejection note */}
                    {r.payment_status === 'rejected' && r.rejection_note && (
                      <p className="text-xs text-red-500 mt-1 italic">&ldquo;{r.rejection_note}&rdquo;</p>
                    )}

                    {/* Proof of payment */}
                    {r.proof_url && (
                      <a
                        href={r.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mt-1"
                      >
                        Lihat bukti transfer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-1.5">
                    <AttendanceToggle registrationId={r.id} attended={!!r.attended} />
                    <RegistrationActions
                      registrationId={r.id}
                      eventId={id}
                      userId={user!.id}
                      paymentStatus={r.payment_status}
                      registrantName={r.registrant_name}
                      registrantPhone={r.registrant_phone}
                      canInviteToJoin={!!r.can_invite_to_join}
                      isInvited={!!r.invited_to_join_at}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kritik & Saran — anonim, untuk konsumsi pribadi instruktur */}
      {(feedbackList ?? []).length > 0 && (
        <Card className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquareWarning className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Kritik & Saran</h2>
          </div>
          <div className="space-y-2">
            {(feedbackList as any[]).map(f => (
              <div key={f.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-700">{f.content}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDateShort(f.created_at)} · Anonim</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
