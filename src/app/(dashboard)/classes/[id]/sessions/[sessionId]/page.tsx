import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Bell, BellOff, MessageSquareWarning } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateShort, formatTime } from '@/lib/utils'
import { SessionActions } from './SessionActions'
import { FeedbackRequestButton } from '@/components/classes/FeedbackRequestButton'

const SESSION_TYPE_CONFIG: Record<string, { label: string; color: 'orange' | 'green' | 'blue' }> = {
  rescheduled:      { label: 'Dijadwal Ulang', color: 'orange' },
  extra:            { label: 'Kelas Ekstra',   color: 'green'  },
  location_changed: { label: 'Lokasi Berubah', color: 'blue'   },
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id, sessionId } = await params
  const supabase          = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch session with class (verify ownership)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (supabase.from('sessions') as any)
    .select(`
      id, class_id, session_date, start_time, end_time, status,
      session_type, original_date, original_time, change_reason,
      notified_at, override_location,
      classes(id, name, location, day_of_week, user_id)
    `)
    .eq('id', sessionId)
    .eq('class_id', id)
    .single() as { data: any }

  if (!session || (session.classes as any)?.user_id !== user!.id) notFound()

  const cls = session.classes as any

  // Attendance count
  const { count: attendanceCount } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  const { data: feedbackList } = await supabase
    .from('session_feedback')
    .select('id, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  const sessionType = session.session_type ?? 'regular'
  const typeCfg     = SESSION_TYPE_CONFIG[sessionType]
  const location    = session.override_location ?? cls.location ?? '-'

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/classes/${id}`} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{cls.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDate(session.session_date)} · {formatTime(session.start_time)} – {formatTime(session.end_time)} · {location}
          </p>
        </div>
      </div>

      {/* Session info card */}
      <Card className="mb-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{formatDateShort(session.session_date)}</p>
          {typeCfg && <Badge color={typeCfg.color}>{typeCfg.label}</Badge>}
        </div>

        {/* Rescheduled: show original */}
        {sessionType === 'rescheduled' && session.original_date && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="text-xs text-orange-600 font-medium">Jadwal Asli</p>
            <p className="text-sm text-orange-700 mt-0.5">
              {formatDateShort(session.original_date)}
              {session.original_time && ` · ${formatTime(session.original_time)}`}
            </p>
            {session.change_reason && (
              <p className="text-xs text-orange-500 mt-1 italic">{session.change_reason}</p>
            )}
          </div>
        )}

        {/* Location changed: show original location */}
        {sessionType === 'location_changed' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-600 font-medium">Lokasi Berubah</p>
            <p className="text-sm text-blue-700 mt-0.5">
              <span className="line-through text-blue-400">{cls.location || 'Lokasi asli'}</span>
              {' → '}
              <span className="font-semibold">{session.override_location}</span>
            </p>
          </div>
        )}

        {/* Attendance */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4 text-gray-400" />
            {attendanceCount ?? 0} peserta hadir
          </div>
          {(attendanceCount ?? 0) > 0 && <FeedbackRequestButton sessionId={session.id} />}
        </div>

        {/* Notification status */}
        <div className="flex items-center gap-2 text-sm">
          {session.notified_at ? (
            <>
              <Bell className="w-4 h-4 text-green-500" />
              <span className="text-green-700">
                Member dinotif {formatDateShort(session.notified_at)}
              </span>
            </>
          ) : (
            <>
              <BellOff className="w-4 h-4 text-gray-300" />
              <span className="text-gray-400">Belum dinotif</span>
            </>
          )}
        </div>
      </Card>

      {/* Action buttons (client component) */}
      <SessionActions
        session={{
          id:           session.id,
          class_id:     session.class_id,
          session_date: session.session_date,
          start_time:   session.start_time,
          end_time:     session.end_time,
          session_type: sessionType,
        }}
        cls={{
          id:          cls.id,
          name:        cls.name,
          location:    cls.location,
          day_of_week: cls.day_of_week,
        }}
      />

      {/* Kritik & Saran - anonim, untuk konsumsi pribadi instruktur */}
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
