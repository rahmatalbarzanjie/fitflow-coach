import { getSystemConfig } from './system-config'

export function normalizePhone(phone: string): string {
  let target = phone.replace(/\D/g, '')
  if (target.startsWith('0')) target = '62' + target.slice(1)
  return target
}

/**
 * Resolusi token Fonnte yang dipakai untuk satu pengiriman.
 *
 * - Kalau parameter instructorToken DIBERIKAN (walau isinya null/kosong) -
 *   ini konteks "kirim atas nama instruktur tertentu" (broadcast, undangan
 *   komunitas, balasan bot WA). Token instruktur WAJIB ada sendiri di sini.
 *   TIDAK ADA fallback ke token platform - kalau token instruktur kosong,
 *   kirim harus gagal dengan jelas, bukan diam-diam terkirim lewat identitas
 *   bot platform/instruktur lain.
 * - Kalau parameter instructorToken TIDAK DIBERIKAN SAMA SEKALI (dipanggil
 *   tanpa argumen ke-3) - ini konteks notifikasi level platform/admin
 *   (konfirmasi pendaftaran instruktur, lupa password, dst) yang memang
 *   didesain memakai token sistem, bukan kegagalan yang harus di-fallback.
 */
async function resolveToken(instructorToken?: string | null): Promise<string | null> {
  if (instructorToken && instructorToken.trim().length > 10) return instructorToken.trim()

  if (instructorToken !== undefined) {
    // Konteks instruktur, tapi token-nya kosong - jangan fallback.
    return null
  }

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
// Dikonfirmasi dari dokumentasi resmi docs.fonnte.com/api-order - mapping
// lama (tebakan awal) ternyata salah/tergeser, itu yang bikin Lite kepilih
// tapi malah Free yang terpasang di percobaan pertama.
export const FONNTE_PLAN_IDS: Record<string, number> = {
  lite:        1,
  regular:     2,
  regular_pro: 3,
  master:      4,
  super:       5,
  advanced:    6,
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
    // name & device wajib diisi di endpoint ini (selain webhook) - tanpa itu
    // Fonnte balas "input invalid" dan webhook tidak pernah benar ter-set.
    // autoread+personal JUGA wajib true - tanpa ini Fonnte tidak meneruskan
    // pesan masuk personal ke webhook sama sekali (device tetap "connect"
    // tapi bot tidak pernah menerima/membalas apa pun).
    const res = await fetch('https://api.fonnte.com/update-device', {
      method:  'POST',
      headers: { Authorization: deviceToken, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: deviceName, device: deviceId, webhook: webhookUrl, autoread: true, personal: true }),
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
    if (json.status === true && json.url) {
      // Fonnte balas data PNG base64 MENTAH di field `url` (nama field-nya
      // menyesatkan - bukan link gambar). Tanpa prefix data URI, <img src>
      // tidak bisa render ini sama sekali (selalu jadi ikon gambar rusak).
      const raw = String(json.url)
      const qr  = /^(https?:|data:)/.test(raw) ? raw : `data:image/png;base64,${raw}`
      return { connected: false, qr }
    }
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
    // sebelumnya dipakai di sini selalu 404 - connect-status jadi tidak
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

export interface FonnteDeviceRow {
  device: string
  name?:  string
  status: string // "connect" | "disconnect"
  token:  string
}

/**
 * Daftar semua device di akun Fonnte (butuh master/account token, bukan
 * token per-device) - sumber kebenaran status live, bukan kolom
 * profiles.bot_phone yang cuma diisi sekali saat connect dan tidak pernah
 * di-recheck.
 */
export async function fonnteGetDevices(masterToken: string): Promise<FonnteDeviceRow[]> {
  try {
    const res = await fetch('https://api.fonnte.com/get-devices', {
      method:  'POST',
      headers: { Authorization: masterToken },
    })
    const json = await res.json()
    return Array.isArray(json?.data) ? json.data : []
  } catch (err) {
    console.error('[WA] Gagal ambil daftar device:', err)
    return []
  }
}

/**
 * Cari device yang SUDAH ADA di akun Fonnte berdasarkan nomor HP, sebelum
 * memutuskan add-device baru. Banyak instruktur (terutama yang lama/sudah
 * pernah disconnect-reconnect) sebenarnya sudah punya device aktif di
 * Fonnte - kalau itu tidak dicek dulu, add-device akan gagal ("device
 * already exist") atau lebih parah, instruktur tidak pernah bisa pakai
 * nomor itu lagi karena sudah "dijatah" device lain.
 *
 * Catatan: ini cuma seandal get-devices itu sendiri - device tier Free
 * kadang tidak muncul di get-devices (sudah dibuktikan terpisah), jadi
 * fungsi ini bisa saja TIDAK menemukan device yang sebenarnya ada kalau
 * device itu Free tier. Tidak ketemu di sini ≠ pasti tidak ada.
 */
export async function fonnteFindDeviceByPhone(masterToken: string, phone: string): Promise<FonnteDeviceRow | null> {
  const target  = normalizePhone(phone)
  const devices = await fonnteGetDevices(masterToken)
  return devices.find(d => normalizePhone(d.device) === target) ?? null
}

/**
 * Cek status live satu device tertentu (dicocokkan lewat fonnte_token,
 * karena device id yang kita kirim ke add-device adalah profileId, tapi
 * lebih aman cocokkan via token yang memang unik per device).
 */
export async function fonnteIsDeviceConnected(masterToken: string, deviceToken: string): Promise<boolean | null> {
  const devices = await fonnteGetDevices(masterToken)
  const match = devices.find(d => d.token === deviceToken)
  if (!match) return null // device tidak ditemukan di akun - tidak bisa dipastikan
  return match.status === 'connect'
}

/**
 * Logout sesi WA device dari Fonnte (tidak menghapus device, tidak butuh
 * OTP - beda dari delete-device). Dipanggil sebelum membersihkan token di
 * database lokal kita, supaya device benar-benar berhenti aktif di Fonnte,
 * bukan cuma "dilupakan" di sisi kita.
 */
export async function fonnteDisconnectDevice(deviceToken: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch('https://api.fonnte.com/disconnect', {
      method:  'POST',
      headers: { Authorization: deviceToken },
    })
    const json = await res.json()
    // "device already disconnected" juga dianggap sukses - tujuan akhirnya
    // (device tidak aktif) sudah tercapai.
    if (json.status === true) return { ok: true }
    if (String(json.detail ?? '').toLowerCase().includes('already disconnected')) return { ok: true }
    return { ok: false, reason: json.detail ?? json.reason ?? 'Gagal disconnect' }
  } catch (err) {
    console.error('[WA] Gagal disconnect device:', err)
    return { ok: false, reason: 'Koneksi ke Fonnte gagal' }
  }
}
