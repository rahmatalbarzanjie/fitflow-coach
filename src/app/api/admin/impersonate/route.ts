import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { profileId } = await request.json().catch(() => ({}))
  if (!profileId) return NextResponse.json({ error: 'profileId wajib' }, { status: 400 })
  if (profileId === user.id) {
    return NextResponse.json({ error: 'Tidak bisa masuk sebagai diri sendiri' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()

  const { data: { user: targetUser }, error: getUserErr } = await serviceSupabase.auth.admin.getUserById(profileId)
  if (getUserErr || !targetUser?.email) {
    return NextResponse.json({ error: 'Instruktur tidak ditemukan' }, { status: 404 })
  }

  const { data: linkData, error: linkErr } = await serviceSupabase.auth.admin.generateLink({
    type:  'magiclink',
    email: targetUser.email,
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkErr?.message ?? 'Gagal membuat sesi' }, { status: 500 })
  }

  // Verifikasi token langsung server-side - ini set cookie sesi instruktur
  // tersebut pada response ini, tanpa lewat email/redirect Supabase sama sekali.
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type:       'magiclink',
    token_hash: linkData.properties.hashed_token,
  })

  if (verifyErr) {
    return NextResponse.json({ error: verifyErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
