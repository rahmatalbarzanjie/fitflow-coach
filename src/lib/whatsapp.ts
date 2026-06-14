export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const token = process.env.FONNTE_TOKEN
  if (!token || token.startsWith('GANTI')) {
    console.warn('[WA] FONNTE_TOKEN belum diset di .env.local')
    return false
  }

  let target = phone.replace(/\D/g, '')
  if (target.startsWith('0')) target = '62' + target.slice(1)
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
