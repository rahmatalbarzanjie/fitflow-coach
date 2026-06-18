import { getSystemConfig } from './system-config'

export function normalizePhone(phone: string): string {
  let target = phone.replace(/\D/g, '')
  if (target.startsWith('0')) target = '62' + target.slice(1)
  return target
}

async function resolveToken(instructorToken?: string | null): Promise<string | null> {
  if (instructorToken && instructorToken.trim().length > 10) return instructorToken.trim()

  const dbToken = await getSystemConfig('fonnte_token').catch(() => null)
  const token = dbToken && dbToken.trim().length > 10 ? dbToken.trim() : process.env.FONNTE_TOKEN

  if (!token || token.startsWith('GANTI') || token.trim() === '') return null
  return token
}

export async function sendWhatsApp(
  phone: string,
  message: string,
  instructorToken?: string | null
): Promise<boolean> {
  const token = await resolveToken(instructorToken)
  if (!token) {
    console.warn('[WA] Token belum diset')
    return false
  }

  const target = normalizePhone(phone)
  if (target.length < 9) return false

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method:  'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ target, message, countryCode: '62' }),
    })
    const json = await res.json()
    return json.status === true
  } catch (err) {
    console.error('[WA] Gagal kirim:', err)
    return false
  }
}

export async function sendWhatsAppToGroup(
  groupId: string,
  message: string,
  instructorToken?: string | null
): Promise<boolean> {
  const token = await resolveToken(instructorToken)
  if (!token || !groupId) return false

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method:  'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ target: groupId, message }),
    })
    const json = await res.json()
    return json.status === true
  } catch (err) {
    console.error('[WA] Gagal kirim ke grup:', err)
    return false
  }
}

export async function fetchWhatsAppGroups(
  instructorToken?: string | null
): Promise<{ id: string; name: string }[]> {
  const token = await resolveToken(instructorToken)
  if (!token) return []

  try {
    // Refresh daftar grup device terlebih dahulu, baru ambil daftarnya.
    await fetch('https://api.fonnte.com/fetch-group', {
      method:  'POST',
      headers: { Authorization: token },
    })

    const res = await fetch('https://api.fonnte.com/get-whatsapp-group', {
      method:  'POST',
      headers: { Authorization: token },
    })
    const json = await res.json()
    const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []

    return list
      .filter((g: any) => g?.id)
      .map((g: any) => ({ id: String(g.id), name: String(g.name ?? g.id) }))
  } catch (err) {
    console.error('[WA] Gagal ambil daftar grup:', err)
    return []
  }
}

// Mapping nama paket Fonnte -> parameter `plan` (integer 1-7) di API Order.
// TEBAKAN AWAL berdasarkan urutan wajar di pricing page Fonnte — dokumentasi
// publik tidak menjelaskan angka mana = paket apa. Validasi di percobaan
// pertama: cek paket yang benar-benar terpasang di dashboard Fonnte setelah
// order, koreksi mapping ini kalau ternyata salah.
export const FONNTE_PLAN_IDS: Record<string, number> = {
  free:        1,
  lite:        2,
  regular:     3,
  regular_pro: 4,
  super:       5,
  master:      6,
  ultra:       7,
}

export async function fonnteAddDevice(
  masterToken: string,
  deviceId: string,
  name: string
): Promise<{ token: string } | { reason: string }> {
  try {
    const res = await fetch('https://api.fonnte.com/add-device', {
      method:  'POST',
      headers: { Authorization: masterToken, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ device: deviceId, name }),
    })
    const json = await res.json()
    if (json.status === true && json.token) return { token: json.token }
    return { reason: json.reason ?? 'Gagal menambah device' }
  } catch (err) {
    console.error('[WA] Gagal add-device:', err)
    return { reason: 'Koneksi ke Fonnte gagal' }
  }
}

export async function fonnteUpdateDeviceWebhook(
  deviceToken: string,
  webhookUrl: string,
  deviceName: string,
  deviceId: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    // name & device wajib diisi di endpoint ini (selain webhook) — tanpa itu
    // Fonnte balas "input invalid" dan webhook tidak pernah benar ter-set.
    const res = await fetch('https://api.fonnte.com/update-device', {
      method:  'POST',
      headers: { Authorization: deviceToken, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: deviceName, device: deviceId, webhook: webhookUrl }),
    })
    const json = await res.json()
    return json.status === true ? { ok: true } : { ok: false, reason: json.reason ?? json.detail }
  } catch (err) {
    console.error('[WA] Gagal update-device webhook:', err)
    return { ok: false, reason: 'Koneksi ke Fonnte gagal' }
  }
}

export async function fonnteOrderPackage(
  deviceToken: string,
  plan: number,
  durationMonths: number
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch('https://api.fonnte.com/order', {
      method:  'POST',
      headers: { Authorization: deviceToken, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plan, duration: 1, 'duration-value': durationMonths }),
    })
    const json = await res.json()
    return json.status === true ? { ok: true } : { ok: false, reason: json.reason }
  } catch (err) {
    console.error('[WA] Gagal order paket:', err)
    return { ok: false, reason: 'Koneksi ke Fonnte gagal' }
  }
}

export async function fonnteGetQr(
  deviceToken: string
): Promise<{ connected: boolean; qr?: string }> {
  try {
    const res = await fetch('https://api.fonnte.com/qr', {
      method:  'POST',
      headers: { Authorization: deviceToken, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type: 'qr' }),
    })
    const json = await res.json()
    if (json.status === true && json.url) return { connected: false, qr: json.url }
    if (json.reason && String(json.reason).toLowerCase().includes('already connect')) {
      return { connected: true }
    }
    return { connected: false }
  } catch (err) {
    console.error('[WA] Gagal ambil QR:', err)
    return { connected: false }
  }
}

export async function fonnteGetDeviceProfile(deviceToken: string): Promise<string | null> {
  try {
    // Endpoint resmi Fonnte adalah /device, bukan /device-profile (yang
    // sebelumnya dipakai di sini selalu 404 — connect-status jadi tidak
    // pernah benar-benar berhasil ambil nomor device otomatis).
    const res = await fetch('https://api.fonnte.com/device', {
      method:  'POST',
      headers: { Authorization: deviceToken },
    })
    const json = await res.json()
    return json.device ?? null
  } catch (err) {
    console.error('[WA] Gagal ambil device profile:', err)
    return null
  }
}
