import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, CheckSquare, Plus } from 'lucide-react'
import { ClassEditForm } from '@/components/classes/ClassEditForm'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDayName, formatDateShort, formatTime } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'
import { GenerateSessionsButton } from '@/components/classes/GenerateSessionsButton'

const TYPE_COLOR: Record<string, 'violet' | 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'gray'> = {
  zumba: 'violet', yoga: 'green', pilates: 'blue',
  poundfit: 'orange', aerobic: 'red', barre: 'yellow', other: 'gray',
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: cls }, { data: sessions }] = await Promise.all([
    supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('sessions')
      .select('id, session_date, status, start_time, end_time, attendance(id)')
      .eq('class_id', id)
      .order('session_date', { ascending: false })
      .limit(20),
  ])

  if (!cls) notFound()

  const today = new Date().toISOString().split('T')[0]
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/classes" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900">{cls.name}</h1>
          <Badge color={TYPE_COLOR[cls.type] ?? 'gray'}>
            {typeLabel[cls.type] ?? cls.type}
          </Badge>
        </div>
        <DeleteButton table="classes" id={id} redirectTo="/classes" />
      </div>

      {/* Edit form */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Informasi Kelas</h2>
        <ClassEditForm cls={cls} />
      </Card>

      {/* Sessions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Jadwal Sesi</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {getDayName(cls.day_of_week)} · {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
            </p>
          </div>
          <GenerateSessionsButton classId={cls.id} />
        </div>

        {!sessions?.length ? (
          <div className="text-center py-10">
            <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400 mb-3">Belum ada sesi yang dibuat</p>
            <GenerateSessionsButton classId={cls.id} variant="primary" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(sessions as any[]).map(s => {
              const count = Array.isArray(s.attendance) ? s.attendance.length : 0
              const isToday = s.session_date === today
              const isPast = s.session_date < today
              return (
                <div key={s.id} className={`flex items-center justify-between py-3 ${isToday ? 'bg-violet-50/50 -mx-5 px-5' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">
                        {formatDateShort(s.session_date)}
                      </p>
                      {isToday && (
                        <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">
                          Hari Ini
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      {count > 0 && <span className="ml-2 font-medium text-gray-600">{count} hadir</span>}
                    </p>
                  </div>
                  <Link
                    href={`/classes/${cls.id}/attendance?date=${s.session_date}`}
                    className={`flex items-center gap-1 h-7 px-3 rounded-lg text-xs font-medium transition-colors ${
                      isToday || !isPast
                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {count > 0 ? 'Lihat' : 'Absen'}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
