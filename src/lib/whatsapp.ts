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
