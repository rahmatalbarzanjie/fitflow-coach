import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLocationChangeMessage } from '@/lib/class-notifications'
import { DAY_NAMES, formatTime } from '@/lib/utils'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const supabase      = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { newLocation, notes, notify } = await request.json()
    if (!newLocation?.trim()) {
      return NextResponse.json({ error: 'Lokasi baru wajib diisi' }, { status: 400 })
    }

    // Get session + class
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session } = await (supabase.from('sessions') as any)
      .select('id, class_id, session_date, start_time, end_time, classes(name, location, user_id, day_of_week)')
      .eq('id', sessionId)
      .single()

    if (!session || (session.classes as any)?.user_id !== user.id) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    }

    const cls = session.classes as any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sessions') as any).update({
      override_location: newLocation.trim(),
      session_type:      'location_changed',
      change_reason:     notes || null,
    }).eq('id', sessionId)

    let broadcastId: string | null = null

    if (notify) {
      const dayName    = DAY_NAMES[cls.day_of_week] ?? 'Hari ini'
      const oldLoc     = cls.location ?? 'lokasi biasa'
      const message    = generateLocationChangeMessage({
        className:   cls.name,
        dayName,
        startTime:   session.start_time,
        endTime:     session.end_time,
        oldLocation: oldLoc,
        newLocation: newLocation.trim(),
      })
      const title = notes
        ? `Ubah Lokasi: ${cls.name} - ${notes.substring(0, 30)}`
        : `Ubah Lokasi: ${cls.name}`

      const { data: broadcast } = await supabase.from('broadcasts').insert({
        user_id:         user.id,
        title,
        content:         message,
        target_audience: 'active',
        status:          'draft',
      }).select('id').single()

      broadcastId = broadcast?.id ?? null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('sessions') as any).update({ notified_at: new Date().toISOString() }).eq('id', sessionId)
    }

    return NextResponse.json({ ok: true, broadcastId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal update lokasi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
