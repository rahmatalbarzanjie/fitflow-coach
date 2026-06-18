import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp, normalizePhone } from '@/lib/whatsapp'
import { DAY_NAMES, formatTime, formatRupiah, formatDate } from '@/lib/utils'

const HISTORY_LIMIT = 20

// Gelar instruktur per tipe kelas — manual dulu, nanti dipindah ke form
// profil instruktur supaya bisa diatur sendiri per akun.
const TYPE_TITLE: Record<string, string> = {
  poundfit: 'Pro',
  barre:    'Teacher',
  zumba:    'Zin',
}

// Tanggal kemunculan kelas berikutnya dari day_of_week (kelas berulang
// mingguan, jadi kuota/peserta per sesi minggu berjalan, bukan kumulatif).
function nextOccurrence(dayOfWeek: number, from: Date) {
  const diff = (dayOfWeek - from.getDay() + 7) % 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

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
      .select('id, name, business_name, phone, slug, fonnte_token, is_platform_admin')
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
        .select('id, name, business_name, phone, slug, fonnte_token, is_platform_admin')
        .ilike('bot_phone', `%${phone!.slice(-9)}%`)
        .single()
      if (data) { instructorProfile = data; break }
    }
  }

  if (!instructorProfile) {
    return NextResponse.json({ ok: true })
  }

  // ── Bot khusus developer/platform admin — device terpisah, akses laporan
  // lintas-instruktur (bukan data satu instruktur seperti flow normal di
  // bawah). Read-only, deterministik, tidak lewat Claude.
  if (instructorProfile.is_platform_admin) {
    const adminPhoneKey = normalizePhone(cleanSender)
    const greet = senderName ? `Kak ${senderName}` : 'Kak'

    async function sendAdminReply(text: string) {
      await supabase.from('wa_conversations').insert([
        { user_id: instructorProfile.id, phone: adminPhoneKey, role: 'user', message },
        { user_id: instructorProfile.id, phone: adminPhoneKey, role: 'assistant', message: text },
      ])
      const senderPhone = cleanSender.startsWith('62') ? '0' + cleanSender.slice(2) : cleanSender
      await sendWhatsApp(senderPhone, text, instructorProfile.fonnte_token ?? null)
      return NextResponse.json({ ok: true, adminPath: true })
    }

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, name, business_name, subscription_status, trial_expires_at, plan_name')
      .eq('is_platform_admin', false)

    const profiles = allProfiles ?? []
    const ids = profiles.map((p: any) => p.id)
    const [{ data: allMembers }, { data: allClasses }] = await Promise.all([
      ids.length > 0 ? supabase.from('members').select('user_id').in('user_id', ids) : Promise.resolve({ data: [] as any[] }),
      ids.length > 0 ? supabase.from('classes').select('user_id').eq('is_active', true).in('user_id', ids) : Promise.resolve({ data: [] as any[] }),
    ])

    const memberCount: Record<string, number> = {}
    ;(allMembers ?? []).forEach((m: any) => { memberCount[m.user_id] = (memberCount[m.user_id] ?? 0) + 1 })
    const classCount: Record<string, number> = {}
    ;(allClasses ?? []).forEach((c: any) => { classCount[c.user_id] = (classCount[c.user_id] ?? 0) + 1 })

    function summarize(p: any) {
      const expiresAt = p.trial_expires_at ? new Date(p.trial_expires_at) : null
      const isActive = expiresAt ? expiresAt > new Date() : false
      const statusLabel = isActive
        ? `Aktif (${p.subscription_status === 'active' ? 'berbayar' : 'trial'}, sampai ${formatDate(p.trial_expires_at)})`
        : expiresAt ? `Expired (${formatDate(p.trial_expires_at)})` : 'Belum ada tanggal expired'
      return `*${p.business_name ?? p.name}* (${p.name})\n` +
        `Member: ${memberCount[p.id] ?? 0} · Kelas aktif: ${classCount[p.id] ?? 0}\n` +
        `Status: ${statusLabel}${p.plan_name ? ` · Paket: ${p.plan_name}` : ''}`
    }

    if (/list instruktur|daftar instruktur|semua instruktur/i.test(message)) {
      const lines = profiles.map(summarize).join('\n\n') || '(belum ada instruktur terdaftar)'
      return sendAdminReply(`Halo ${greet}! 📋 Daftar instruktur (${profiles.length}):\n\n${lines}`)
    }

    if (/member.*(paling banyak|terbanyak)/i.test(message)) {
      const sorted = [...profiles].sort((a: any, b: any) => (memberCount[b.id] ?? 0) - (memberCount[a.id] ?? 0)).slice(0, 5)
      const lines = sorted.map((p: any, i: number) => `${i + 1}. *${p.business_name ?? p.name}* — ${memberCount[p.id] ?? 0} member`).join('\n')
      return sendAdminReply(`Halo ${greet}! 🏆 Ranking member terbanyak:\n\n${lines || '(belum ada data)'}`)
    }

    if (/kelas.*(paling banyak|terbanyak)/i.test(message)) {
      const sorted = [...profiles].sort((a: any, b: any) => (classCount[b.id] ?? 0) - (classCount[a.id] ?? 0)).slice(0, 5)
      const lines = sorted.map((p: any, i: number) => `${i + 1}. *${p.business_name ?? p.name}* — ${classCount[p.id] ?? 0} kelas aktif`).join('\n')
      return sendAdminReply(`Halo ${greet}! 🏆 Ranking kelas terbanyak:\n\n${lines || '(belum ada data)'}`)
    }

    const statusMatch = /status\s+(?:langganan\s+)?(.+)/i.exec(message)
    if (statusMatch) {
      const query = statusMatch[1].trim().toLowerCase()
      const found = profiles.find((p: any) =>
        p.name.toLowerCase().includes(query) || (p.business_name ?? '').toLowerCase().includes(query)
      )
      if (found) return sendAdminReply(`Halo ${greet}! 📋 ${summarize(found)}`)
      return sendAdminReply(`Halo ${greet}! Maaf, tidak ketemu instruktur dengan nama "${statusMatch[1].trim()}" 🙏`)
    }

    return sendAdminReply(
      `Halo ${greet}! 👋 Aku asisten developer FitFlow Coach.\n\n` +
      `Kamu bisa tanya:\n` +
      `- "list instruktur"\n` +
      `- "member terbanyak" / "kelas terbanyak"\n` +
      `- "status langganan {nama instruktur}"`
    )
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

  // Nomor pribadi instruktur (beda dari nomor bot) — dipakai untuk fallback
  // "hubungi langsung" yang sebenarnya mengarah ke kontak lain, bukan ke
  // nomor bot yang sedang dipakai untuk chat ini.
  const personalPhone = instructorProfile.phone ? normalizePhone(instructorProfile.phone) : null
  const hasDistinctPersonalPhone = !!personalPhone && personalPhone !== cleanDevice

  // Sapaan "Kak" — selalu pakai ini, plus nama kalau Fonnte kasih nama kontaknya
  const greetName = senderName ? `Kak ${senderName}` : 'Kak'

  const titleLines = Object.entries(TYPE_TITLE)
    .map(([type, title]) => `- ${type[0].toUpperCase()}${type.slice(1)} → "${title} ${instructorProfile.name}"`)
    .join('\n')

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

  function formatClassLine(c: any) {
    const price   = Number(c.class_price) > 0 ? formatRupiah(Number(c.class_price)) : 'Gratis'
    const regLink = slug ? `${appUrl}/${slug}/daftar/kelas/${c.id}` : '(link belum tersedia)'
    return `- *${c.name}* (${c.type}): ${DAY_NAMES[c.day_of_week]}, ${formatTime(c.start_time)}–${formatTime(c.end_time)}` +
      `${c.location ? ` di ${c.location}` : ''}` +
      `${c.capacity ? ` (maks ${c.capacity} orang)` : ''}\n` +
      `  Harga: ${price}\n  Daftar: ${regLink}`
  }

  const classLines = (classes ?? []).map(formatClassLine).join('\n\n') || '- (belum ada kelas terdaftar)'

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

  // Kirim balasan deterministik (tanpa panggil Claude), simpan ke riwayat,
  // lalu selesai. Dipakai semua fast-path di bawah (jadwal & laporan).
  async function sendFastReply(text: string) {
    await supabase.from('wa_conversations').insert([
      { user_id: instructorProfile.id, phone: senderPhoneKey, role: 'user', message },
      { user_id: instructorProfile.id, phone: senderPhoneKey, role: 'assistant', message: text },
    ])
    const senderPhone = cleanSender.startsWith('62') ? '0' + cleanSender.slice(2) : cleanSender
    await sendWhatsApp(senderPhone, text, instructorProfile.fonnte_token ?? null)
    return NextResponse.json({ ok: true, fastPath: true })
  }

  // ── Laporan khusus instruktur (read-only) — hanya aktif kalau pengirim
  // adalah nomor pribadi instruktur sendiri, BUKAN calon member/peserta yang
  // sedang chat ke bot. Mencegah orang luar minta data peserta/member orang.
  const isInstructorSender = !!personalPhone && cleanSender === personalPhone
  if (isInstructorSender) {
    // 1) Peserta kelas tertentu — "siapa yang daftar kelas Barre", "peserta poundfit"
    const pesertaMatch = /(?:siapa(?:\s+yang)?\s+(?:daftar|ikut)|peserta|daftar\s+peserta)\s*(?:kelas\s+)?(.+)/i.exec(message)
    if (pesertaMatch) {
      const query = pesertaMatch[1].trim().toLowerCase()
      const matchedClasses = (classes ?? []).filter((c: any) =>
        c.name.toLowerCase().includes(query) || c.type.toLowerCase().includes(query) || query.includes(c.type.toLowerCase())
      )
      if (matchedClasses.length > 0) {
        const blocks = await Promise.all(matchedClasses.map(async (c: any) => {
          const targetDate = nextOccurrence(c.day_of_week, now)
          const { data: regs } = await supabase
            .from('registrations')
            .select('registrant_name, payment_status')
            .eq('class_id', c.id)
            .eq('session_date', targetDate)
            .in('payment_status', ['pending', 'confirmed'])
          const lines = (regs ?? []).map((r: any) =>
            `- ${r.registrant_name}${r.payment_status === 'pending' ? ' (belum konfirmasi)' : ''}`
          ).join('\n') || '(belum ada yang daftar)'
          return `*${c.name}* — ${formatDate(targetDate)}\n${lines}\nTotal: ${regs?.length ?? 0} orang`
        }))
        return sendFastReply(`Halo Kak! 📋 Ini daftar peserta yang Kakak minta:\n\n${blocks.join('\n\n')}`)
      }
    }

    // 2) Absensi/kehadiran hari ini — "absensi hari ini", "siapa yang hadir"
    if (/absensi|kehadiran|siapa.*hadir|yang hadir/i.test(message)) {
      const { data: todaySessions } = await supabase
        .from('sessions')
        .select('id, classes(name)')
        .eq('user_id', instructorProfile.id)
        .eq('session_date', today)
      const sessionIds = (todaySessions ?? []).map((s: any) => s.id)
      const { data: attendanceRows } = sessionIds.length > 0
        ? await supabase.from('attendance').select('session_id, members(name)').in('session_id', sessionIds)
        : { data: [] as any[] }

      if (!todaySessions || todaySessions.length === 0) {
        return sendFastReply(`Halo Kak! 📋 Tidak ada kelas hari ini, jadi belum ada absensi untuk dilaporkan ya 😊`)
      }

      const blocks = todaySessions.map((s: any) => {
        const names = (attendanceRows ?? [])
          .filter((a: any) => a.session_id === s.id)
          .map((a: any) => `- ${(a.members as any)?.name ?? '(tanpa nama)'}`)
          .join('\n') || '(belum ada yang absen)'
        return `*${s.classes?.name ?? 'Kelas'}*\n${names}`
      })
      return sendFastReply(`Halo Kak! 📋 Absensi hari ini (${todayLabel}):\n\n${blocks.join('\n\n')}`)
    }

    // 3) Ringkasan member — "berapa member aktif", "member at risk"
    if (/berapa\s+member|member\s+aktif|member\s+at.?risk|jumlah\s+member/i.test(message)) {
      const [{ count: total }, { count: active }, { count: atRisk }, { count: inactive }] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id).eq('status', 'active'),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id).eq('status', 'at_risk'),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id).eq('status', 'inactive'),
      ])
      return sendFastReply(
        `Halo Kak! 📋 Ringkasan member:\n\n` +
        `Total: ${total ?? 0} member\n` +
        `✅ Aktif: ${active ?? 0}\n` +
        `⚠️ Perlu perhatian: ${atRisk ?? 0}\n` +
        `💤 Tidak aktif: ${inactive ?? 0}`
      )
    }
  }

  // ── Fast-path: pertanyaan jadwal dijawab langsung tanpa panggil Claude ──────
  // Ini intent paling sering & jawabannya selalu sama (daftar kelas/event apa
  // adanya) — daripada bayar token Claude + tunggu API tiap kali, langsung
  // kirim data jadwal yang sudah disusun di atas. AI tetap dipakai untuk
  // pertanyaan lain (termasuk follow-up setelah fast-path ini, karena balasan
  // ini juga disimpan ke riwayat).
  const isScheduleQuery = /\bjadwal\b|kelas apa (aja|saja)|ada kelas apa/i.test(message)
  if (isScheduleQuery) {
    const asksToday     = /hari ini/i.test(message)
    const todayClasses  = (classes ?? []).filter((c: any) => c.day_of_week === now.getDay())
    const scopedClasses = asksToday ? todayClasses : (classes ?? [])
    const scopedLines   = scopedClasses.length > 0
      ? scopedClasses.map(formatClassLine).join('\n\n')
      : (asksToday ? '- (tidak ada kelas hari ini)' : '- (belum ada kelas terdaftar)')

    const fastReply =
      `Halo ${greetName}! 👋 ${asksToday ? `Jadwal hari ini (${todayLabel}):` : `Ini jadwal kelas di *${studioName}*:`}\n\n${scopedLines}` +
      (!asksToday && events && events.length > 0 ? `\n\nEvent mendatang:\n\n${eventLines}` : '') +
      `\n\nMau daftar kelas/event yang mana, Kak? Tinggal sebutin aja ya 😊`

    return sendFastReply(fastReply)
  }

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

GELAR INSTRUKTUR PER TIPE KELAS (sebut instruktur dengan gelar ini kalau lagi ngomongin kelas tipe itu, bukan cuma nama polos):
${titleLines}
- Tipe lain → "${instructorProfile.name}" saja (tanpa gelar)

CARA MENJAWAB:
- WAJIB selalu panggil orang yang chat dengan sebutan "Kak" — contoh: "Halo ${greetName}!", "Boleh, Kak!", "Siap, Kak 😊". Jangan pernah panggil nama tanpa "Kak" di depannya
- Selalu bersikap suportif, hangat, dan memotivasi — buat orang yang chat merasa dihargai dan disambut baik, bukan dilayani robot
- Gunakan Bahasa Indonesia yang ramah dan santai, emoji secukupnya
- Jawaban ringkas (idealnya 3-5 kalimat), TAPI kalau ada lebih dari satu topik/konteks dalam satu balasan, pisah jadi paragraf baru (baris kosong) per topik — jangan ditumpuk jadi satu paragraf panjang, supaya nyaman dibaca di WhatsApp
- PENTING soal format bold: WhatsApp cuma pakai SATU tanda bintang untuk tebal (*teks*) — JANGAN PERNAH pakai dua bintang (**teks**) seperti markdown biasa, itu akan tampil rusak
- Kamu SUDAH TAHU hari ini hari apa (lihat "Hari ini" di atas) — jangan pernah tanya balik hari/tanggal ke peserta, langsung cocokkan ke jadwal kelas yang sesuai
- Untuk pertanyaan jadwal atau event → berikan info yang ada di atas
- Kalau orang menyatakan niat daftar/ikut kelas atau event TERTENTU, cocokkan namanya dengan data di atas dan balas dengan link "Daftar" yang SESUAI dengan item itu — jangan sampai ketuker kasih link kelas/event lain
- Kalau tidak jelas kelas/event mana yang dimaksud (nama disebut umum, atau ada beberapa kandidat yang cocok), tanya dulu mau yang mana sebelum kasih link apa pun — jangan menebak
- Kalau cuma tanya-tanya info tanpa niat daftar, jawab informatif saja tanpa otomatis menyodorkan link
- Kalau orang bilang mau "gabung komunitas"/"join grup" — ini BUKAN niat daftar kelas/event, jangan cocokkan ke kelas manapun dan jangan kasih link registrasi. Cukup jawab ramah dan arahkan sesuai instruksi kontak di bawah
- Jika pertanyaan tidak bisa dijawab dari data di atas${hasDistinctPersonalPhone ? `, atau orang minta ngobrol langsung dengan manusia` : ''} → ${hasDistinctPersonalPhone ? `sarankan hubungi ${instructorProfile.name} langsung di ${instructorProfile.phone} (nomor pribadi, beda dari nomor chat ini)` : `sarankan hubungi ${instructorProfile.name} langsung`}
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
    // Jaga-jaga kalau model tetap pakai markdown dua bintang — WhatsApp cuma
    // kenal satu bintang untuk bold, dua bintang tampil rusak (bintangnya
    // ikut kelihatan).
    reply = reply.replace(/\*\*/g, '*')
  } catch (err) {
    console.error('[WA Bot] Claude error:', err)
    reply = `Halo ${greetName}! Maaf ya, asisten kami sedang sibuk 🙏 Silakan hubungi ${instructorProfile.name} langsung ya 😊`
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
