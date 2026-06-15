import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Called silently on dashboard load.
// For each active class, if no session exists in the next 14 days → generate 8 weeks.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const in14Days = new Date()
    in14Days.setDate(in14Days.getDate() + 14)
    const in14DaysStr = in14Days.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    // Get all active classes
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!classes?.length) return NextResponse.json({ filled: 0 })

    // For each class, check if there's at least one session in next 14 days
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upcoming } = await (supabase.from('sessions') as any)
      .select('class_id')
      .eq('user_id', user.id)
      .gte('session_date', today)
      .lte('session_date', in14DaysStr)
      .in('class_id', classes.map(c => c.id))

    const coveredIds = new Set((upcoming ?? []).map((s: any) => s.class_id))
    const needFill   = classes.filter(c => !coveredIds.has(c.id))

    // Generate sessions for classes that need it
    await Promise.all(
      needFill.map(c =>
        supabase.rpc('generate_sessions_for_class', { p_class_id: c.id, p_days: 56 })
      )
    )

    return NextResponse.json({ filled: needFill.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Auto-fill failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
