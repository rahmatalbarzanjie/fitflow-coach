import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'
import { DAY_NAMES, formatTime, formatRupiah } from '@/lib/utils'

/*
 * POST /api/wa/incoming?key=FONNTE_WEBHOOK_KEY
 *
 * Dipanggil oleh Fonnte (webhook incoming message).
 * Setup di Fonnte Dashboard → Device → Webhook → masukkan URL ini.
 *
 * Body dari Fonnte:
 *   { device, sender, message, name, id }
 *
 * Alur:
 *  1. Validasi key
 *  2. Cari instruktur berdasarkan nomor device
 *  3. Fetch jadwal kelas + event instruktur
 *  4. Claude AI jawab pesan
 *  5. Kirim balasan via Fonnte ke sender
 */

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (key !== process.env.FONNTE_WEBHOOK_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false })

  const { device, sender, message, name: senderName } = body

  // Abaikan jika tidak ada pesan teks
  if (!message || typeof message !== 'string') return NextResponse.json({ ok: true })

  // Abaikan pesan dari device sendiri (instruktur ngirim ke diri sendiri)
  const cleanDevice = String(device ?? '').replace(/\D/g, '')
  const cleanSender = String(sender ?? '').replace(/\D/g, '')
  if (cleanSender === cleanDevice) return NextResponse.json({ ok: true })

  const supabase = createServiceClient()

  // ── Cari instruktur berdasarkan nomor device ───────────────────────────────
  // Fonnte device = nomor WA instruktur (format 628xxx)
  const deviceVariants = [
    cleanDevice,
    cleanDevice.startsWith('62') ? '0' + cleanDevice.slice(2) : null,
  ].filter(Boolean)

  let instructorProfile: any = null
  for (const phone of deviceVariants) {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, business_name, phone, slug')
      .ilike('phone', `%${phone!.slice(-9)}%`)
      .single()
    if (data) { instructorProfile = data; break }
  }

  if (!instructorProfile) {
    // Nomor device tidak terdaftar — abaikan
    return NextResponse.json({ ok: true })
  }

  const today = new Date().toISOString().split('T')[0]

  // ── Ambil data instruktur untuk konteks AI ────────────────────────────────
  const [{ data: classes }, { data: events }] = await Promise.all([
    supabase
      .from('classes')
      .select('name, type, day_of_week, start_time, end_time, location, capacity')
      .eq('user_id', instructorProfile.id)
      .order('day_of_week')
      .order('start_time'),

    supabase
      .from('events')
      .select('title, slug, event_date, start_time, location, ots_price, early_bird_price, early_bird_deadline, description')
      .eq('user_id', instructorProfile.id)
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date')
      .limit(5),
  ])

  const studioName = instructorProfile.business_name ?? instructorProfile.name
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const slug       = instructorProfile.slug ?? ''

  const classLines = (classes ?? []).map((c: any) =>
    `- ${c.name} (${c.type}): ${DAY_NAMES[c.day_of_week]}, ${formatTime(c.start_time)}–${formatTime(c.end_time)}` +
    `${c.location ? ` di ${c.location}` : ''}` +
    `${c.capacity ? ` (maks ${c.capacity} orang)` : ''}`
  ).join('\n') || '- (belum ada kelas terdaftar)'

  const eventLines = (events ?? []).map((e: any) => {
    const ebAvail = Number(e.early_bird_price) > 0 &&
      e.early_bird_deadline &&
      new Date(e.early_bird_deadline) > new Date()
    const price = ebAvail
      ? `Early Bird ${formatRupiah(Number(e.early_bird_price))} / OTS ${formatRupiah(Number(e.ots_price))}`
      : `${formatRupiah(Number(e.ots_price))}`
    const regLink = slug ? `${appUrl}/${slug}/daftar/${e.slug}` : '(link belum tersedia)'
    return `- *${e.title}* — ${e.event_date} pukul ${formatTime(e.start_time)}` +
      `${e.location ? ` di ${e.location}` : ''}\n  Harga: ${price}\n  Daftar: ${regLink}` +
      (e.description ? `\n  Info: ${e.description}` : '')
  }).join('\n\n') || '- (tidak ada event mendatang)'

  const systemPrompt =
    `Kamu adalah asisten WhatsApp untuk *${studioName}*, studio fitness yang dikelola oleh ${instructorProfile.name}.

INFORMASI STUDIO:
- Nama: ${studioName}
- Instruktur: ${instructorProfile.name}
- Halaman publik: ${appUrl}/${slug}

JADWAL KELAS RUTIN:
${classLines}

EVENT MENDATANG:
${eventLines}

CARA MENJAWAB:
- Gunakan Bahasa Indonesia yang ramah, hangat, dan santai
- Jawaban SINGKAT — maks 3-4 kalimat (ini WhatsApp, bukan email)
- Gunakan emoji secukupnya agar terasa personal
- Untuk pertanyaan jadwal atau event → berikan info yang ada di atas
- Untuk link pendaftaran event → copy-paste link yang ada
- Jika pertanyaan tidak bisa dijawab → sarankan hubungi ${instructorProfile.name} langsung di nomor yang sama
- JANGAN membuat info, harga, atau jadwal yang tidak ada di data di atas
- Mulai jawaban langsung tanpa sapaan panjang`

  // ── Panggil Claude AI ─────────────────────────────────────────────────────
  let reply = ''
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const userMsg   = senderName ? `[${senderName}]: ${message}` : message

    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMsg }],
    })

    reply = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
  } catch (err) {
    console.error('[WA Bot] Claude error:', err)
    reply = `Halo! Maaf, asisten kami sedang sibuk. Silakan hubungi ${instructorProfile.name} langsung ya 😊`
  }

  // ── Kirim balasan via Fonnte ──────────────────────────────────────────────
  if (reply) {
    const senderPhone = cleanSender.startsWith('62')
      ? '0' + cleanSender.slice(2)
      : cleanSender
    await sendWhatsApp(senderPhone, reply)
  }

  return NextResponse.json({ ok: true })
}
