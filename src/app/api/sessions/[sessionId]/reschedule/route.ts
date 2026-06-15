import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRescheduleMessage } from '@/lib/class-notifications'
import { DAY_NAMES } from '@/lib/utils'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const supabase      = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { newDate, newStartTime, newEndTime, reason, notify } = await request.json()
    if (!newDate || !newStartTime || !newEndTime) {
      return NextResponse.json({ error: 'Tanggal dan jam wajib diisi' }, { status: 400 })
    }

    // Get current session + class info (verify ownership via class.user_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session } = await (supabase.from('sessions') as any)
      .select('id, class_id, session_date, start_time, end_time, classes(name, location, user_id, day_of_week)')
      .eq('id', sessionId)
      .single()

    if (!session || (session.classes as any)?.user_id !== user.id) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    }

    const cls = session.classes as any

    // Update session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sessions') as any).update({
      session_date:  newDate,
      start_time:    newStartTime,
      end_time:      newEndTime,
      session_type:  'rescheduled',
      original_date: session.session_date,
      original_time: session.start_time,
      change_reason: reason || null,
    }).eq('id', sessionId)

    let broadcastId: string | null = null

    if (notify) {
      const originalDay  = DAY_NAMES[cls.day_of_week] ?? 'Hari biasa'
      const originalTime = String(session.start_time).substring(0, 5)

      const message = generateRescheduleMessage({
        className:    cls.name,
        originalDay,
        originalTime,
        newDate,
        newStartTime,
        newEndTime,
        location:     cls.location ?? '',
      })

      const { data: broadcast } = await supabase.from('broadcasts').insert({
        user_id:         user.id,
        title:           `Reschedule: ${cls.name} - ${newDate}`,
        content:         message,
        target_audience: 'active',
        status:          'draft',
      }).select('id').single()

      broadcastId = broadcast?.id ?? null

      // Mark notified
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('sessions') as any).update({ notified_at: new Date().toISOString() }).eq('id', sessionId)
    }

    return NextResponse.json({ ok: true, broadcastId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal update sesi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
