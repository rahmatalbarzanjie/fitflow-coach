import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateExtraClassMessage } from '@/lib/class-notifications'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      classId, sessionDate, startTime, endTime,
      location, capacity, notes, notify, targetAudience,
    } = await request.json()

    if (!classId || !sessionDate || !startTime || !endTime) {
      return NextResponse.json({ error: 'Data wajib belum lengkap' }, { status: 400 })
    }

    // Verify class ownership
    const { data: cls } = await supabase
      .from('classes')
      .select('id, name, user_id')
      .eq('id', classId)
      .eq('user_id', user.id)
      .single()

    if (!cls) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 })

    // Insert extra session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newSession, error: insertErr } = await (supabase.from('sessions') as any).insert({
      class_id:     classId,
      user_id:      user.id,
      session_date: sessionDate,
      start_time:   startTime,
      end_time:     endTime,
      session_type: 'extra',
      status:       'scheduled',
      notes:        notes || null,
    }).select('id').single()

    if (insertErr) throw insertErr

    let broadcastId: string | null = null

    if (notify) {
      const message = generateExtraClassMessage({
        className: cls.name,
        date:      sessionDate,
        startTime,
        endTime,
        location:  location || '',
        capacity:  capacity || null,
        notes:     notes || '',
      })

      const audience = targetAudience ?? 'all'
      const { data: broadcast } = await supabase.from('broadcasts').insert({
        user_id:         user.id,
        title:           `Kelas Ekstra: ${cls.name} - ${sessionDate}`,
        content:         message,
        target_audience: audience,
        status:          'draft',
      }).select('id').single()

      broadcastId = broadcast?.id ?? null

      // Mark notified
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('sessions') as any)
        .update({ notified_at: new Date().toISOString() })
        .eq('id', newSession.id)
    }

    return NextResponse.json({ ok: true, sessionId: newSession.id, broadcastId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal membuat kelas ekstra'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
