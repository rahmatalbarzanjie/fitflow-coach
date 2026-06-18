import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSystemConfig } from '@/lib/system-config'
import {
  fonnteAddDevice, fonnteUpdateDeviceWebhook, fonnteOrderPackage, FONNTE_PLAN_IDS,
} from '@/lib/whatsapp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { profileId, plan, durationMonths } = await request.json().catch(() => ({}))
  if (!profileId) return NextResponse.json({ error: 'profileId wajib' }, { status: 400 })

  const serviceSupabase = createServiceClient()

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('name, business_name')
    .eq('id', profileId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Instruktur tidak ditemukan' }, { status: 404 })

  const masterToken = (await getSystemConfig('fonnte_token')) || process.env.FONNTE_TOKEN
  if (!masterToken) {
    return NextResponse.json({ error: 'Token akun master Fonnte belum diset di Konfigurasi' }, { status: 400 })
  }

  const deviceName = ((profile as any).business_name ?? (profile as any).name ?? 'Instruktur').slice(0, 30)
  const added = await fonnteAddDevice(masterToken, profileId, deviceName)

  if ('reason' in added) {
    return NextResponse.json({ error: added.reason }, { status: 500 })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const webhookUrl = `${appUrl}/api/wa/incoming?key=${process.env.FONNTE_WEBHOOK_KEY}`
  const webhookResult = await fonnteUpdateDeviceWebhook(added.token, webhookUrl, deviceName, profileId)

  const warnings: string[] = []
  if (!webhookResult.ok) {
    warnings.push(`Gagal set webhook otomatis (${webhookResult.reason ?? 'tidak diketahui'}). Bot tidak akan bisa balas pesan sampai webhook di-set manual di dashboard Fonnte.`)
  }
  if (plan && FONNTE_PLAN_IDS[plan] && durationMonths) {
    const order = await fonnteOrderPackage(added.token, FONNTE_PLAN_IDS[plan], Number(durationMonths))
    if (!order.ok) {
      warnings.push(`Gagal pasang paket: ${order.reason ?? 'tidak diketahui'}. Device masih di paket Free - bisa diassign manual di dashboard Fonnte.`)
    }
  }

  const { error: updateErr } = await serviceSupabase
    .from('profiles')
    .update({ fonnte_token: added.token })
    .eq('id', profileId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, warning: warnings.length > 0 ? `Device terhubung, tapi: ${warnings.join(' ')}` : undefined })
}
