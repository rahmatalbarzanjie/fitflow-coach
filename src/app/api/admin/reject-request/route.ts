import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { requestId } = await request.json()
    const serviceSupabase = createServiceClient()

    const { error } = await serviceSupabase
      .from('instructor_requests')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menolak permintaan' },
      { status: 500 }
    )
  }
}
