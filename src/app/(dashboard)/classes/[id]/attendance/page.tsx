import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { AttendanceSheet } from '@/components/attendance/AttendanceSheet'
import { formatDateShort, formatTime } from '@/lib/utils'

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id }   = await params
  const { date = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0] } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch kelas
  const { data: cls } = await (supabase.from('classes') as any)
    .select('id, name, type, start_time, end_time, user_id, payment_mode, class_price')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!cls) notFound()

  // Cari atau buat sesi
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
      <div className="p-4 text-sm text-red-600">
        Gagal memuat sesi. Coba refresh halaman.
      </div>
    )
  }

  // Fetch paralel: member aktif + booking + attendance yang sudah ada
  // ── Komunitas tidak dipakai sebagai sumber peserta ──
  const [membersRes, bookingsRes, attendanceRes] = await Promise.all([
    // Member aktif instruktur
    (supabase.from('members') as any)
      .select('id, name, phone')
      .eq('user_id', user!.id)
      .eq('status', 'active')
      .order('name'),

    // Booking kelas yang dikonfirmasi untuk tanggal ini
    (supabase.from('registrations') as any)
      .select('id, registrant_name, registrant_phone, member_id')
      .eq('class_id', id)
      .eq('session_date', date)
      .eq('payment_status', 'confirmed'),

    // Absensi yang sudah ada di sesi ini
    supabase
      .from('attendance')
      .select('id, member_id, source, registrant_name, registrant_phone')
      .eq('session_id', session.id),
  ])

  const subtitle = `${formatDateShort(date)} · ${formatTime(cls.start_time)}–${formatTime(cls.end_time)}`

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-4">
        <PageHeader
          backHref={`/classes/${id}`}
          title={cls.name}
          subtitle={subtitle}
        />
      </div>

      <AttendanceSheet
        cls={cls}
        session={session}
        members={membersRes.data ?? []}
        bookings={bookingsRes.data ?? []}
        existingAttendance={attendanceRes.data ?? []}
      />
    </div>
  )
}
