import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp, normalizePhone } from '@/lib/whatsapp'
import { DAY_NAMES, formatTime, formatRupiah } from '@/lib/utils'

const HISTORY_LIMIT = 20

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

  const { device, sender, message, name: senderName, instructor_id } = body

  // Abaikan jika tidak ada pesan teks
  if (!message || typeof message !== 'string') return NextResponse.json({ ok: true })

  // Abaikan pesan dari device sendiri (cegah loop balasan bot)
  const cleanDevice = String(device ?? '').replace(/\D/g, '')
  const cleanSender = String(sender ?? '').replace(/\D/g, '')
  if (cleanSender && cleanDevice && cleanSender === cleanDevice) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()

  // ── Cari instruktur ───────────────────────────────────────────────────────
  // Prioritas: instructor_id dari Node-RED config (langsung, tidak perlu lookup)
  // Fallback: cari berdasarkan nomor device Fonnte di tabel profiles
  let instructorProfile: any = null

  if (instructor_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, business_name, phone, slug, fonnte_token')
      .eq('id', instructor_id)
      .single()
    instructorProfile = data ?? null
  }

  if (!instructorProfile) {
    const deviceVariants = [
      cleanDevice,
      cleanDevice.startsWith('62') ? '0' + cleanDevice.slice(2) : null,
    ].filter(Boolean)

    // Cocokkan ke bot_phone (nomor bot Fonnte), bukan phone (nomor pribadi instruktur)
    for (const phone of deviceVariants) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, business_name, phone, slug, fonnte_token')
        .ilike('bot_phone', `%${phone!.slice(-9)}%`)
        .single()
      if (data) { instructorProfile = data; break }
    }
  }

  if (!instructorProfile) {
    return NextResponse.json({ ok: true })
  }

  const today = new Date().toISOString().split('T')[0]

  // ── Ambil data instruktur untuk konteks AI ────────────────────────────────
  const [{ data: classes }, { data: events }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, type, day_of_week, start_time, end_time, location, capacity, class_price')
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

  const now        = new Date()
  const todayLabel = `${DAY_NAMES[now.getDay()]}, ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`

  // ── Riwayat percakapan thread ini (instruktur + nomor pengirim) ────────────
  const senderPhoneKey = normalizePhone(cleanSender)
  const { data: historyRows } = await supabase
    .from('wa_conversations')
    .select('role, message')
    .eq('user_id', instructorProfile.id)
    .eq('phone', senderPhoneKey)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const history = (historyRows ?? []).reverse()

  const classLines = (classes ?? []).map((c: any) => {
    const price   = Number(c.class_price) > 0 ? formatRupiah(Number(c.class_price)) : 'Gratis'
    const regLink = slug ? `${appUrl}/${slug}/daftar/kelas/${c.id}` : '(link belum tersedia)'
    return `- *${c.name}* (${c.type}): ${DAY_NAMES[c.day_of_week]}, ${formatTime(c.start_time)}–${formatTime(c.end_time)}` +
      `${c.location ? ` di ${c.location}` : ''}` +
      `${c.capacity ? ` (maks ${c.capacity} orang)` : ''}\n` +
      `  Harga: ${price}\n  Daftar: ${regLink}`
  }).join('\n\n') || '- (belum ada kelas terdaftar)'

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
- Hari ini: ${todayLabel}
- Halaman publik: ${appUrl}/${slug}

JADWAL KELAS RUTIN:
${classLines}

EVENT MENDATANG:
${eventLines}

CARA MENJAWAB:
- Gunakan Bahasa Indonesia yang ramah, hangat, dan santai
- Jawaban SINGKAT — maks 3-4 kalimat (ini WhatsApp, bukan email)
- Gunakan emoji secukupnya agar terasa personal
- Kamu SUDAH TAHU hari ini hari apa (lihat "Hari ini" di atas) — jangan pernah tanya balik hari/tanggal ke peserta, langsung cocokkan ke jadwal kelas yang sesuai
- Untuk pertanyaan jadwal atau event → berikan info yang ada di atas
- Kalau orang menyatakan niat daftar/ikut kelas atau event TERTENTU, cocokkan namanya dengan data di atas dan balas dengan link "Daftar" yang SESUAI dengan item itu — jangan sampai ketuker kasih link kelas/event lain
- Kalau tidak jelas kelas/event mana yang dimaksud (nama disebut umum, atau ada beberapa kandidat yang cocok), tanya dulu mau yang mana sebelum kasih link apa pun — jangan menebak
- Kalau cuma tanya-tanya info tanpa niat daftar, jawab informatif saja tanpa otomatis menyodorkan link
- Jika pertanyaan tidak bisa dijawab → sarankan hubungi ${instructorProfile.name} langsung di nomor yang sama
- JANGAN membuat info, harga, atau jadwal yang tidak ada di data di atas
- Mulai jawaban langsung tanpa sapaan panjang`

  // ── Panggil Claude AI (dengan riwayat percakapan thread ini) ────────────────
  let reply = ''
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const userMsg   = senderName ? `[${senderName}]: ${message}` : message

    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   [
        ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.message })),
        { role: 'user', content: userMsg },
      ],
    })

    reply = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
  } catch (err) {
    console.error('[WA Bot] Claude error:', err)
    reply = `Halo! Maaf, asisten kami sedang sibuk. Silakan hubungi ${instructorProfile.name} langsung ya 😊`
  }

  // ── Simpan riwayat (pesan masuk + balasan) ──────────────────────────────────
  await supabase.from('wa_conversations').insert([
    { user_id: instructorProfile.id, phone: senderPhoneKey, role: 'user', message },
    ...(reply ? [{ user_id: instructorProfile.id, phone: senderPhoneKey, role: 'assistant', message: reply }] : []),
  ])

  // ── Kirim balasan via Fonnte ──────────────────────────────────────────────
  if (reply) {
    const senderPhone = cleanSender.startsWith('62')
      ? '0' + cleanSender.slice(2)
      : cleanSender
    await sendWhatsApp(senderPhone, reply, instructorProfile.fonnte_token ?? null)
  }

  return NextResponse.json({ ok: true })
}
