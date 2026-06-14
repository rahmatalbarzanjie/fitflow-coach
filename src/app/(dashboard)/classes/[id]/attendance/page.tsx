import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AttendanceSheet } from '@/components/attendance/AttendanceSheet'

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id }   = await params
  const { date = new Date().toISOString().split('T')[0] } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch class — 404 if not owner
  const { data: cls } = await supabase
    .from('classes')
    .select('id, name, type, start_time, end_time, user_id')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!cls) notFound()

  // Find existing session for this date, or create one
  let { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('class_id', id)
    .eq('session_date', date)
    .single()

  if (!session) {
    const { data: newSession } = await supabase
      .from('sessions')
      .insert({
        class_id:     id,
        user_id:      user!.id,
        session_date: date,
        start_time:   cls.start_time,
        end_time:     cls.end_time,
        status:       'ongoing',
      })
      .select()
      .single()
    session = newSession
  }

  if (!session) {
    return (
      <div className="text-sm text-red-600 p-4">
        Gagal memuat sesi. Coba lagi.
      </div>
    )
  }

  // Load all instructor's members + existing attendance in parallel
  const [{ data: members }, { data: existingAttendance }] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, phone, status')
      .eq('user_id', user!.id)
      .order('name'),
    supabase
      .from('attendance')
      .select('id, member_id, payment_mode, payment_method, amount_paid')
      .eq('session_id', session.id),
  ])

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/classes/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke {cls.name}
        </Link>
      </div>

      <AttendanceSheet
        cls={cls}
        session={session}
        members={members ?? []}
        existingAttendance={existingAttendance ?? []}
      />
    </div>
  )
}
