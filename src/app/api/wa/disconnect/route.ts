import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fonnteDisconnectDevice } from '@/lib/whatsapp'

/**
 * Logout device dari Fonnte SEBELUM membersihkan token di database lokal.
 * Tanpa ini, "disconnect" cuma menghapus catatan kita - device tetap
 * aktif/connect di sisi Fonnte (masih makan slot device berbayar).
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('fonnte_token')
    .eq('id', user.id)
    .single()

  const token = profile?.fonnte_token as string | null

  if (token) {
    const result = await fonnteDisconnectDevice(token)
    if (!result.ok) {
      // Tetap lanjut bersihkan DB lokal - jangan biarkan instruktur stuck
      // gara-gara Fonnte API down/error, tapi catat alasannya.
      console.warn('[WA] Disconnect Fonnte tidak sepenuhnya berhasil:', result.reason)
    }
  }

  await (supabase.from('profiles') as any)
    .update({ fonnte_token: null, bot_phone: null, bot_phone_requested: null })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
