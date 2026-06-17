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
    return NextResponse.json({ error: 'Tidak bisa menghapus akun developer sendiri' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()

  // instructor_requests.profile_id tidak ON DELETE CASCADE — lepaskan
  // referensinya dulu supaya riwayat pendaftaran tetap ada tapi tidak
  // menghalangi penghapusan akun (semua tabel lain sudah CASCADE).
  await serviceSupabase
    .from('instructor_requests')
    .update({ profile_id: null })
    .eq('profile_id', profileId)

  const { error } = await serviceSupabase.auth.admin.deleteUser(profileId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
