import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(request: Request) {
  try {
    // Auth check — admin only
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { requestId } = await request.json()
    if (!requestId) return NextResponse.json({ error: 'requestId wajib' }, { status: 400 })

    const serviceSupabase = createServiceClient()

    // Get the pending request
    const { data: req } = await serviceSupabase
      .from('instructor_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()

    if (!req) return NextResponse.json({ error: 'Permintaan tidak ditemukan atau sudah diproses' }, { status: 404 })

    const tempPassword = generateTempPassword()
    const trialExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

    // Create Supabase auth user
    const { data: authData, error: authErr } = await serviceSupabase.auth.admin.createUser({
      email:         req.email,
      password:      tempPassword,
      email_confirm: true,
    })

    if (authErr) {
      if (authErr.message.toLowerCase().includes('already')) {
        throw new Error('Email ini sudah punya akun terdaftar sebelumnya. Klik Tolak untuk pendaftaran ini, lalu minta pendaftar login langsung di halaman Masuk.')
      }
      throw new Error(`Gagal buat akun: ${authErr.message}`)
    }
    const newUserId = authData.user.id

    // Create profile
    const { error: profileErr } = await serviceSupabase
      .from('profiles')
      .insert({
        id:                  newUserId,
        name:                req.name,
        business_name:       req.business_name ?? null,
        phone:               req.phone,
        subscription_status: 'trial',
        trial_expires_at:    trialExpiresAt,
      })

    if (profileErr) throw new Error(`Gagal buat profil: ${profileErr.message}`)

    // Mark request confirmed
    await serviceSupabase
      .from('instructor_requests')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), profile_id: newUserId })
      .eq('id', requestId)

    // Send WA with credentials
    const message = [
      `Halo ${req.name}! 🎉`,
      ``,
      `Pendaftaran FitFlow Coach kamu telah *dikonfirmasi*.`,
      ``,
      `Info login kamu:`,
      `🔗 *Link:* ${appUrl}/login`,
      `📧 *Email:* ${req.email}`,
      `🔑 *Password:* ${tempPassword}`,
      ``,
      `Masa trial *30 hari* dimulai hari ini.`,
      `Segera ganti password setelah login pertama di menu *Pengaturan*.`,
      ``,
      `Selamat bergabung! 💪`,
    ].join('\n')

    const waOk = await sendWhatsApp(req.phone, message)

    return NextResponse.json({ ok: true, email: req.email, waOk })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Konfirmasi gagal' },
      { status: 500 }
    )
  }
}
