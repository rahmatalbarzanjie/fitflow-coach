import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Public endpoint — no auth required. Creates a pending registration request.
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

    // Check for duplicate email
    const { data: existing } = await serviceSupabase
      .from('instructor_requests')
      .select('id, status')
      .eq('email', email)
      .single()

    if (existing) {
      const label = existing.status === 'confirmed' ? 'sudah terdaftar' : 'sudah mengirim permintaan dan sedang menunggu konfirmasi'
      return NextResponse.json({ error: `Email ini ${label}.` }, { status: 409 })
    }

    const { error } = await serviceSupabase
      .from('instructor_requests')
      .insert({ name, business_name: business_name || null, email, phone, city: city || null })

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengirim permintaan' },
      { status: 500 }
    )
  }
}
