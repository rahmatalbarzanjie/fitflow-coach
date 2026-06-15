import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ensure a session record exists for a given class + date.
// Returns the session id (creates one if missing).
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { classId, sessionDate } = await request.json()
    if (!classId || !sessionDate) {
      return NextResponse.json({ error: 'classId dan sessionDate wajib' }, { status: 400 })
    }

    // Verify ownership
    const { data: cls } = await supabase
      .from('classes')
      .select('id, start_time, end_time, user_id')
      .eq('id', classId)
      .eq('user_id', user.id)
      .single()

    if (!cls) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 })

    // Check if session already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: selectErr } = await (supabase.from('sessions') as any)
      .select('id, session_type, original_date, original_time, override_location, notified_at, start_time, end_time')
      .eq('class_id', classId)
      .eq('session_date', sessionDate)
      .maybeSingle()

    if (selectErr) throw new Error(selectErr.message)

    if (existing) {
      return NextResponse.json({ sessionId: existing.id, session: existing, created: false })
    }

    // Create new session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newSession, error: insertErr } = await (supabase.from('sessions') as any)
      .insert({
        class_id:     classId,
        user_id:      user.id,
        session_date: sessionDate,
        start_time:   cls.start_time,
        end_time:     cls.end_time,
        status:       'scheduled',
        session_type: 'regular',
      })
      .select('id, session_type, original_date, original_time, override_location, notified_at, start_time, end_time')
      .single()

    if (insertErr) throw new Error(insertErr.message)

    return NextResponse.json({ sessionId: newSession.id, session: newSession, created: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memastikan sesi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
