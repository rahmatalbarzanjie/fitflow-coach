import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'
import { getSystemConfig } from '@/lib/system-config'

// Public endpoint - no auth required. Creates a pending registration request.
export async function POST(request: Request) {
  try {
    const { name, business_name, email, phone, city } = await request.json()

    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Nama, email, dan nomor WA wajib diisi' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient()

    // Check for duplicate email - hanya blokir kalau masih pending/confirmed.
    // Request yang sudah 'rejected' tidak boleh menghalangi pendaftaran ulang.
    const { data: existingRows } = await serviceSupabase
      .from('instructor_requests')
      .select('id, status')
      .eq('email', email)
      .in('status', ['pending', 'confirmed'])
      .limit(1)

    if (existingRows && existingRows.length > 0) {
      const label = existingRows[0].status === 'confirmed' ? 'sudah terdaftar' : 'sudah mengirim permintaan dan sedang menunggu konfirmasi'
      return NextResponse.json({ error: `Email ini ${label}.` }, { status: 409 })
    }

    // Cek juga apakah email ini sudah punya akun Supabase Auth (misal pernah
    // daftar sendiri lewat /register) - supaya tidak lolos sampai tahap
    // konfirmasi admin baru ketahuan gagal.
    const { data: userList } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 })
    const emailExists = userList?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase())
    if (emailExists) {
      return NextResponse.json(
        { error: 'Email ini sudah punya akun terdaftar. Silakan langsung login di halaman Masuk.' },
        { status: 409 }
      )
    }

    const { error } = await serviceSupabase
      .from('instructor_requests')
      .insert({ name, business_name: business_name || null, email, phone, city: city || null })

    if (error) throw new Error(error.message)

    // Notifikasi ke developer/admin - best-effort, jangan gagalkan request kalau ini error
    try {
      const adminWa = (await getSystemConfig('admin_wa')) || process.env.NEXT_PUBLIC_ADMIN_WA || ''
      if (adminWa) {
        const message = [
          `🔔 *Pendaftaran Instruktur Baru*`,
          ``,
          `Nama: ${name}`,
          business_name ? `Studio: ${business_name}` : null,
          `Email: ${email}`,
          `WA: ${phone}`,
          city ? `Kota: ${city}` : null,
          ``,
          `Cek & konfirmasi di halaman Admin Panel.`,
        ].filter(Boolean).join('\n')

        await sendWhatsApp(adminWa, message)
      }
    } catch {
      // Notifikasi gagal tidak boleh menggagalkan pendaftaran
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengirim permintaan' },
      { status: 500 }
    )
  }
}
