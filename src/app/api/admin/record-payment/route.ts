import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { profileId, amount, paymentDate, method, durationMonths, notes } = await request.json().catch(() => ({}))

  if (!profileId || !amount || !durationMonths) {
    return NextResponse.json({ error: 'profileId, amount, durationMonths wajib diisi' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('trial_expires_at')
    .eq('id', profileId)
    .single()

  const currentExpiry = (profile as { trial_expires_at: string | null } | null)?.trial_expires_at
  const base = currentExpiry && new Date(currentExpiry) > new Date() ? new Date(currentExpiry) : new Date()
  base.setMonth(base.getMonth() + Number(durationMonths))

  const { error: payErr } = await serviceSupabase.from('payments').insert({
    profile_id:      profileId,
    amount:          Number(amount),
    payment_date:    paymentDate || new Date().toISOString().split('T')[0],
    method:          method || null,
    duration_months: Number(durationMonths),
    notes:           notes || null,
    recorded_by:     user.id,
  })

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

  const { error: profileErr } = await serviceSupabase
    .from('profiles')
    .update({ trial_expires_at: base.toISOString(), subscription_status: 'active' })
    .eq('id', profileId)

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
