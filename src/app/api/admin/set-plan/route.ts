import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { profileId, planName, maxActiveClasses, maxBroadcastPerMonth } = await request.json().catch(() => ({}))
  if (!profileId) return NextResponse.json({ error: 'profileId wajib diisi' }, { status: 400 })

  const serviceSupabase = createServiceClient()
  const { error } = await serviceSupabase
    .from('profiles')
    .update({
      plan_name:               planName || null,
      max_active_classes:      maxActiveClasses === '' || maxActiveClasses == null ? null : Number(maxActiveClasses),
      max_broadcast_per_month: maxBroadcastPerMonth === '' || maxBroadcastPerMonth == null ? null : Number(maxBroadcastPerMonth),
    })
    .eq('id', profileId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
