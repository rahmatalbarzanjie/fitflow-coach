import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSystemConfig } from '@/lib/system-config'
import {
  fonnteAddDevice, fonnteUpdateDeviceWebhook, fonnteOrderPackage, FONNTE_PLAN_IDS,
  fonnteFindDeviceByPhone,
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
    .select('name, business_name, bot_phone_requested')
    .eq('id', profileId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Instruktur tidak ditemukan' }, { status: 404 })

  const masterToken = (await getSystemConfig('fonnte_token')) || process.env.FONNTE_TOKEN
  if (!masterToken) {
    return NextResponse.json({ error: 'Token akun master Fonnte belum diset di Konfigurasi' }, { status: 400 })
  }

  const deviceName     = ((profile as any).business_name ?? (profile as any).name ?? 'Instruktur').slice(0, 30)
  const requestedPhone = String((profile as any).bot_phone_requested ?? '').replace(/\D/g, '')

  // Cek dulu apakah nomor ini SUDAH ADA sebagai device di Fonnte (instruktur
  // lama, atau pernah disconnect-reconnect) - kalau ada, pakai itu, jangan
  // add-device baru. Tanpa ini, nomor yang sudah terdaftar tidak akan
  // pernah bisa dipakai lagi lewat FitFlow (selalu ditolak "device already
  // exist" oleh Fonnte, atau device baru dibuat tapi tidak pernah bisa
  // connect karena nomornya sudah "dijatah" device lama).
  const existing = requestedPhone
    ? await fonnteFindDeviceByPhone(masterToken, requestedPhone)
    : null

  const warnings: string[] = []
  let token: string
  let alreadyConnected = false

  if (existing) {
    // Device sudah ada di Fonnte - sinkronkan ke FitFlow, jangan buat baru.
    token = existing.token
    alreadyConnected = existing.status === 'connect'

    const appUrl     = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const webhookUrl = `${appUrl}/api/wa/incoming?key=${process.env.FONNTE_WEBHOOK_KEY}`
    const webhookResult = await fonnteUpdateDeviceWebhook(token, webhookUrl, deviceName, requestedPhone)
    if (!webhookResult.ok) {
      warnings.push(`Gagal set ulang webhook (${webhookResult.reason ?? 'tidak diketahui'}). Bot mungkin tidak bisa balas pesan sampai webhook di-cek manual di dashboard Fonnte.`)
    }
    // TIDAK order paket baru - device existing biasanya sudah punya paket sendiri.
  } else {
    // Device belum ada - buat baru seperti biasa.
    const deviceId = requestedPhone.length >= 8 && requestedPhone.length <= 15
      ? requestedPhone
      : profileId.replace(/-/g, '').slice(0, 15)
    const added = await fonnteAddDevice(masterToken, deviceId, deviceName)

    if ('reason' in added) {
      return NextResponse.json({ error: added.reason }, { status: 500 })
    }
    token = added.token

    const appUrl     = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const webhookUrl = `${appUrl}/api/wa/incoming?key=${process.env.FONNTE_WEBHOOK_KEY}`
    const webhookResult = await fonnteUpdateDeviceWebhook(token, webhookUrl, deviceName, profileId)
    if (!webhookResult.ok) {
      warnings.push(`Gagal set webhook otomatis (${webhookResult.reason ?? 'tidak diketahui'}). Bot tidak akan bisa balas pesan sampai webhook di-set manual di dashboard Fonnte.`)
    }
    if (plan && FONNTE_PLAN_IDS[plan] && durationMonths) {
      const order = await fonnteOrderPackage(token, FONNTE_PLAN_IDS[plan], Number(durationMonths))
      if (!order.ok) {
        warnings.push(`Gagal pasang paket: ${order.reason ?? 'tidak diketahui'}. Device masih di paket Free - bisa diassign manual di dashboard Fonnte.`)
      }
    }
  }

  const { error: updateErr } = await serviceSupabase
    .from('profiles')
    .update({
      fonnte_token: token,
      // Kalau device existing sudah "connect" di Fonnte, langsung simpan
      // bot_phone - tidak perlu instruktur scan QR lagi.
      ...(alreadyConnected ? { bot_phone: requestedPhone } : {}),
    })
    .eq('id', profileId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    attachedExisting: !!existing,
    alreadyConnected,
    warning: warnings.length > 0 ? `Device terhubung, tapi: ${warnings.join(' ')}` : undefined,
  })
}
