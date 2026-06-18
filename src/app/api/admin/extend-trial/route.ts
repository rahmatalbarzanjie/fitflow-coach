import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/*
 * POST /api/admin/extend-trial
 * Body: { profileId: string, action: 'extend', months: number } | { profileId: string, action: 'end' }
 *
 * TrialManager sebelumnya update `profiles` langsung dari browser (RLS-bound),
 * tapi policy update cuma izinkan auth.uid() = id — gagal diam-diam saat admin
 * mengubah profil instruktur lain. Pakai service-role di sini supaya benar.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { profileId, action, months } = await request.json().catch(() => ({}))
  if (!profileId || !action) {
    return NextResponse.json({ error: 'profileId dan action wajib diisi' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()

  if (action === 'end') {
    const { error } = await serviceSupabase
      .from('profiles')
      .update({ trial_expires_at: new Date().toISOString() })
      .eq('id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'extend') {
    if (!months || Number(months) <= 0) {
      return NextResponse.json({ error: 'months wajib diisi' }, { status: 400 })
    }

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('trial_expires_at')
      .eq('id', profileId)
      .single()

    const currentExpiry = (profile as { trial_expires_at: string | null } | null)?.trial_expires_at
    const base = currentExpiry && new Date(currentExpiry) > new Date() ? new Date(currentExpiry) : new Date()
    base.setMonth(base.getMonth() + Number(months))

    const { error } = await serviceSupabase
      .from('profiles')
      .update({ trial_expires_at: base.toISOString(), subscription_status: 'trial' })
      .eq('id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action tidak dikenal' }, { status: 400 })
}
