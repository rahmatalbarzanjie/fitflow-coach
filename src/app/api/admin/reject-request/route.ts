import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { requestId } = await request.json()
    const serviceSupabase = createServiceClient()

    // Fetch request details to send WA notification
    const { data: req } = await serviceSupabase
      .from('instructor_requests')
      .select('name, phone')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()

    if (!req) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan atau sudah diproses' }, { status: 404 })
    }

    const { error } = await serviceSupabase
      .from('instructor_requests')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', requestId)

    if (error) throw new Error(error.message)

    // Notify applicant via WA
    const message = [
      `Halo ${req.name},`,
      ``,
      `Terima kasih sudah mendaftar FuelOS.`,
      ``,
      `Mohon maaf, saat ini kami belum bisa menerima pendaftaran kamu.`,
      `Jika ada pertanyaan, hubungi kami langsung melalui WhatsApp ini.`,
    ].join('\n')

    const waOk = await sendWhatsApp(req.phone, message)

    return NextResponse.json({ ok: true, waOk })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menolak permintaan' },
      { status: 500 }
    )
  }
}
