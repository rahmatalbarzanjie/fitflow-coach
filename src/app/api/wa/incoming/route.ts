import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp, normalizePhone } from '@/lib/whatsapp'
import { DAY_NAMES, formatTime, formatRupiah, formatDate } from '@/lib/utils'
import { CLASS_TYPES } from '@/lib/constants'

const HISTORY_LIMIT = 20

// Gelar instruktur per tipe kelas - manual dulu, nanti dipindah ke form
// profil instruktur supaya bisa diatur sendiri per akun.
const TYPE_TITLE: Record<string, string> = {
  poundfit: 'Pro',
  barre: 'Teacher',
  zumba: 'Zin',
}

// Tanggal kemunculan kelas berikutnya dari day_of_week (kelas berulang
// mingguan, jadi kuota/peserta per sesi minggu berjalan, bukan kumulatif).
function nextOccurrence(dayOfWeek: number, from: Date) {
  const diff = (dayOfWeek - from.getDay() + 7) % 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

// Format jeda waktu untuk konteks AI ("2 jam", "45 menit") - dipakai supaya
// bot sadar kalau balasan terakhirnya sudah lama, bukan baru saja, jadi
// tidak asal lanjutkan tawaran/topik basi (lihat isFreshThread & ack
// fast-path di bawah).
function formatElapsed(minutes: number): string {
  if (minutes < 1) return 'kurang dari 1 menit'
  if (minutes < 60) return `${Math.round(minutes)} menit`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} jam`
  return `${Math.round(hours / 24)} hari`
}

type ClassType = 'poundfit' | 'barre' | 'zumba' | 'yoga' | 'pilates' | 'aerobic' | 'other'

// Niat lintas-komunitas selalu menang - kalau pesan menyebut tipe kelas lain
// secara eksplisit, itu yang dipakai, terlepas dari komunitas asal pengirim.
function detectExplicitClassType(message: string): ClassType | null {
  const lower = message.toLowerCase()
  for (const t of CLASS_TYPES) {
    if (t.value === 'other') continue
    if (lower.includes(t.value) || lower.includes(t.label.toLowerCase())) return t.value
  }
  return null
}

// Klasifikasi KHUSUS (bukan prompt balasan utama, tidak diubah) untuk
// deteksi pesan yang harus diteruskan ke instruktur manusia, bukan dijawab
// bot - komplain, cedera/sakit, refund, atau mau berhenti jadi member.
// Gagal klasifikasi (mis. API error) → anggap TIDAK perlu handover, supaya
// flow normal tetap jalan, bot tidak pernah "diam" karena error di sini.
async function classifyHandover(message: string): Promise<boolean> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      system: `Klasifikasikan apakah pesan WhatsApp peserta ini berisi salah satu dari: komplain, cedera/sakit, masalah/refund pembayaran, atau ingin berhenti jadi member. Balas HANYA dengan satu kata "YA" atau "TIDAK", tanpa tanda baca atau kata lain.`,
      messages: [{ role: 'user', content: message }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text.trim().toUpperCase() : ''
    return text.startsWith('YA')
  } catch (err) {
    console.error('[WA Bot] Gagal klasifikasi handover:', err)
    return false
  }
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

  const { device, sender, message: rawMessage, name: senderName, instructor_id, id: fonnteMessageId } = body

  // Abaikan jika tidak ada pesan teks
  if (!rawMessage || typeof rawMessage !== 'string') return NextResponse.json({ ok: true })

  // `message` di-reassign nanti kalau pesan ini bagian dari burst beruntun
  // yang digabung (lihat blok debounce di bawah) - lihat juga komentar di
  // formatElapsed soal alasan kenapa ini perlu jadi `let`, bukan `const`.
  let message: string = rawMessage

  const supabase = createServiceClient()

  // ── Idempotency ───────────────────────────────────────────────────────────
  // Fonnte bisa retry webhook yang sama (timeout, jaringan, dst). Tanpa ini,
  // retry berarti balasan terkirim DUA KALI ke peserta yang sama. Insert
  // duluan ke wa_webhook_log - kalau message id ini sudah pernah masuk
  // (PRIMARY KEY conflict), hentikan di sini, jangan proses ulang apa pun.
  if (fonnteMessageId) {
    const { error: dedupeErr } = await supabase
      .from('wa_webhook_log')
      .insert({ fonnte_message_id: String(fonnteMessageId) })
    if (dedupeErr) {
      // Conflict (kode 23505) = pesan ini sudah pernah diproses - berhenti.
      // Error lain (mis. tabel belum ada) - jangan blokir bot, lanjut proses
      // seperti biasa supaya gagal pada tahap idempotency tidak mematikan
      // seluruh fitur balas pesan.
      if ((dedupeErr as { code?: string }).code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true })
      }
    }
  }

  // Abaikan pesan dari device sendiri (cegah loop balasan bot)
  const cleanDevice = String(device ?? '').replace(/\D/g, '')
  const cleanSender = String(sender ?? '').replace(/\D/g, '')
  if (cleanSender && cleanDevice && cleanSender === cleanDevice) {
    return NextResponse.json({ ok: true })
  }

  // ── Handle pesan dari GRUP KOMUNITAS (Level 1) ────────────────────────────
  // Fonnte mengirim sender = "groupid@g.us" dan member = nomor pengirim asli
  // kalau pesan dari grup WA. Kita manfaatkan ini untuk auto-capture kontak
  // komunitas tanpa perlu instruktur input manual.
  const isGroupMessage = String(sender ?? '').includes('@g.us')

  if (isGroupMessage) {
    const groupId = String(sender ?? '')                          // "xxx@g.us"
    const memberPhone = String(body.member ?? '').replace(/\D/g, '') // nomor pengirim di grup
    const memberName = String(senderName ?? '').trim() || null

    if (memberPhone) {
      // Cari instruktur yang punya grup komunitas ini (class_type_benefits.wa_group_id)
      const { data: benefit } = await supabase
        .from('class_type_benefits')
        .select('user_id, type')
        .eq('wa_group_id', groupId)
        .maybeSingle()

      if (benefit) {
        // Normalisasi nomor: 628xxx → 08xxx
        const phoneNorm = memberPhone.startsWith('62')
          ? '0' + memberPhone.slice(2)
          : memberPhone

        // Cek apakah sudah ada di community_contacts (by phone + user_id)
        const { data: existing } = await supabase
          .from('community_contacts')
          .select('id, name')
          .eq('user_id', benefit.user_id)
          .eq('phone', phoneNorm)
          .eq('class_type', benefit.type as 'zumba' | 'yoga' | 'pilates' | 'poundfit' | 'aerobic' | 'barre' | 'other')
          .maybeSingle()

        if (!existing) {
          // Belum ada → insert otomatis
          await supabase.from('community_contacts').insert({
            user_id: benefit.user_id,
            name: memberName,
            phone: phoneNorm,
            class_type: benefit.type as 'zumba' | 'yoga' | 'pilates' | 'poundfit' | 'aerobic' | 'barre' | 'other',   // poundfit / barre / dll
            source: 'wa_group',     // tandai asal dari grup WA
          })
        } else if (memberName && !existing.name) {
          // Sudah ada tapi belum punya nama → update nama
          await supabase
            .from('community_contacts')
            .update({ name: memberName })
            .eq('id', existing.id)
        }
      }
    }

    // Pesan dari grup tidak perlu dibalas bot — langsung selesai
    return NextResponse.json({ ok: true, source: 'group_capture' })
  }


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

  // ── Bot khusus developer/platform admin - device terpisah dari bot
  // instruktur manapun. Device ini dobel fungsi:
  //  1. Developer sendiri (nomor pribadinya) → laporan lintas-instruktur,
  //     read-only, deterministik, tidak lewat Claude.
  //  2. Siapa pun yang lain (calon klien yang tertarik FuelOS,
  //     biasanya nyasar dari landing page instruktur → /home) → asisten AI
  //     yang jawab soal aplikasi FuelOS itu sendiri (fitur, harga,
  //     trial, cara daftar) - BUKAN data instruktur mana pun.
  if (instructorProfile.is_platform_admin) {
    const adminPhoneKey = normalizePhone(cleanSender)
    const greet = senderName ? `Kak ${senderName}` : 'Kak'
    const devPersonalPhone = instructorProfile.phone ? normalizePhone(instructorProfile.phone) : null
    const isDeveloperSender = !!devPersonalPhone && cleanSender === devPersonalPhone

    async function sendAdminReply(text: string) {
      await supabase.from('wa_conversations').insert([
        { user_id: instructorProfile.id, phone: adminPhoneKey, role: 'user', message },
        { user_id: instructorProfile.id, phone: adminPhoneKey, role: 'assistant', message: text },
      ])
      const senderPhone = cleanSender.startsWith('62') ? '0' + cleanSender.slice(2) : cleanSender
      await sendWhatsApp(senderPhone, text, instructorProfile.fonnte_token ?? null)
      return NextResponse.json({ ok: true, adminPath: true })
    }

    if (isDeveloperSender) {
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
        ; (allMembers ?? []).forEach((m: any) => { memberCount[m.user_id] = (memberCount[m.user_id] ?? 0) + 1 })
      const classCount: Record<string, number> = {}
        ; (allClasses ?? []).forEach((c: any) => { classCount[c.user_id] = (classCount[c.user_id] ?? 0) + 1 })

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
        const lines = sorted.map((p: any, i: number) => `${i + 1}. *${p.business_name ?? p.name}* - ${memberCount[p.id] ?? 0} member`).join('\n')
        return sendAdminReply(`Halo ${greet}! 🏆 Ranking member terbanyak:\n\n${lines || '(belum ada data)'}`)
      }

      if (/kelas.*(paling banyak|terbanyak)/i.test(message)) {
        const sorted = [...profiles].sort((a: any, b: any) => (classCount[b.id] ?? 0) - (classCount[a.id] ?? 0)).slice(0, 5)
        const lines = sorted.map((p: any, i: number) => `${i + 1}. *${p.business_name ?? p.name}* - ${classCount[p.id] ?? 0} kelas aktif`).join('\n')
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
        `Halo ${greet}! 👋 Aku asisten developer FuelOS.\n\n` +
        `Kamu bisa tanya:\n` +
        `- "list instruktur"\n` +
        `- "member terbanyak" / "kelas terbanyak"\n` +
        `- "status langganan {nama instruktur}"`
      )
    }

    // ── Bukan developer → calon klien yang tertarik FuelOS ──────────
    const platformAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const { data: prospectHistoryRows } = await supabase
      .from('wa_conversations')
      .select('role, message')
      .eq('user_id', instructorProfile.id)
      .eq('phone', adminPhoneKey)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
    const prospectHistory = (prospectHistoryRows ?? []).reverse()

    const productSystemPrompt =
      `Kamu adalah asisten WhatsApp resmi untuk *FuelOS* - aplikasi SaaS untuk instruktur fitness Indonesia (kelola kelas, member, event, absensi digital, broadcast WhatsApp, AI bot WA otomatis, dan laporan pendapatan).

TENTANG FuelOS:
- Trial: 30 hari GRATIS, akses SEMUA fitur tanpa batas, tanpa kartu kredit
- Cara mulai: isi form di ${platformAppUrl}/daftar - tim kami konfirmasi manual, biasanya cepat
- Info & demo lengkap: ${platformAppUrl}/home

PAKET HARGA (semua paket dapat AI Caption Generator & AI Bot WA - bedanya cuma kuota):
- Starter Rp99.000/bulan - 3 kelas aktif, 150 broadcast WA/bulan
- Pro Rp199.000/bulan (PALING POPULER) - 10 kelas aktif, 600 broadcast WA/bulan
- Studio Rp349.000/bulan - kelas & broadcast unlimited
- Diskon: 3 bulan -10%, 6 bulan -15%, 12 bulan bayar 10 gratis 2 bulan
- Pembayaran manual via transfer, dicatat tim kami - tidak ada kontrak jangka panjang, bisa ganti paket kapan saja

CARA MENJAWAB:
- WAJIB selalu panggil orang yang chat dengan sebutan "Kak" - contoh: "Halo ${greet}!", "Boleh, Kak!"
- Selalu suportif, hangat, dan memotivasi - buat calon klien merasa disambut baik
- Bahasa Indonesia santai, emoji secukupnya
- Jawaban ringkas, kalau ada beberapa topik pisah jadi paragraf baru (baris kosong) - jangan satu paragraf panjang
- PENTING: WhatsApp cuma pakai SATU bintang untuk bold (*teks*) - JANGAN PERNAH dua bintang (**teks**)
- Kalau orang tertarik daftar/coba, arahkan ke ${platformAppUrl}/daftar (trial 30 hari dulu, baru pilih paket)
- Kalau pertanyaannya di luar soal FuelOS (misal nanya soal kelas/jadwal instruktur tertentu), jelaskan ini bot khusus info aplikasi FuelOS, sarankan hubungi instruktur terkait langsung
- JANGAN mengarang fitur/harga yang tidak ada di atas
- Mulai jawaban langsung tanpa sapaan panjang`

    let prospectReply = ''
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const userMsg = senderName ? `[${senderName}]: ${message}` : message
      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: productSystemPrompt,
        messages: [
          ...prospectHistory.map(h => ({ role: h.role as 'user' | 'assistant', content: h.message })),
          { role: 'user', content: userMsg },
        ],
      })
      prospectReply = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
      prospectReply = prospectReply.replace(/\*\*/g, '*')
    } catch (err) {
      console.error('[WA Bot] Claude error (product assistant):', err)
      prospectReply = `Halo ${greet}! Maaf, asisten kami sedang sibuk 🙏 Coba cek ${platformAppUrl}/home untuk info lengkap ya.`
    }

    return sendAdminReply(prospectReply)
  }

  // ── Debounce pesan beruntun ──────────────────────────────────────────────
  // Peserta WA sering kirim beberapa pesan pendek berturutan (mis. "kak"
  // lalu 2 detik kemudian "ada kelas yoga besok?") - tanpa ini, bot membalas
  // ke pesan PERTAMA yang belum lengkap, kelihatan motong omongan. Trik:
  // tiap pesan masuk dicatat ke wa_message_buffer SEGERA, invocation ini
  // tunggu DEBOUNCE_MS. Kalau selama nunggu muncul pesan lebih baru dari
  // sender yang sama, invocation ini "kalah" - berhenti tanpa balas (biar
  // invocation milik pesan TERBARU yang menang dan gabungkan semua pesan
  // yang masih menumpuk jadi satu giliran percakapan sebelum diproses).
  const DEBOUNCE_MS = 3000
  const senderPhoneKey = normalizePhone(cleanSender)

  const { data: bufferedRow } = await supabase
    .from('wa_message_buffer')
    .insert({ user_id: instructorProfile.id, phone: senderPhoneKey, message: rawMessage })
    .select('id, created_at')
    .single()

  if (bufferedRow) {
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS))

    const { count: newerCount } = await supabase
      .from('wa_message_buffer')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', instructorProfile.id)
      .eq('phone', senderPhoneKey)
      .gt('created_at', bufferedRow.created_at)

    if ((newerCount ?? 0) > 0) {
      // Bukan invocation terbaru - pesan yang lebih baru akan menggabungkan
      // (termasuk pesan ini) dan membalas sekali untuk semuanya.
      return NextResponse.json({ ok: true, debounced: true })
    }

    const { data: pending } = await supabase
      .from('wa_message_buffer')
      .select('id, message')
      .eq('user_id', instructorProfile.id)
      .eq('phone', senderPhoneKey)
      .order('created_at', { ascending: true })

    if (pending && pending.length > 0) {
      message = pending.map(p => p.message).join('\n')
      await supabase.from('wa_message_buffer').delete().in('id', pending.map(p => p.id))
    }
  }

  const today = new Date().toISOString().split('T')[0]

  // ── Sender Resolution + Multi-Community Context ───────────────────────────
  // Bot perlu tahu SIAPA yang chat dan KOMUNITAS mana sebelum membalas -
  // dicek berurutan: member terdaftar → kontak komunitas (sekaligus dapat
  // class_type-nya) → pernah daftar kelas/event → tidak dikenal. Hasilnya
  // cuma dicatat di wa_conversations (untuk histori/audit), TIDAK mengubah
  // konten balasan atau apa yang dikirim ke AI.
  type SenderKind = 'member' | 'community_contact' | 'registrant' | 'unknown'
  let senderKind: SenderKind = 'unknown'
  let senderRefId: string | null = null
  let senderClassType: ClassType | null = null

  if (cleanSender) {
    const senderPhoneLocal = cleanSender.startsWith('62') ? '0' + cleanSender.slice(2) : cleanSender
    const senderPhoneIntl  = cleanSender.startsWith('0')  ? '62' + cleanSender.slice(1) : cleanSender
    const phoneVariants = [...new Set([senderPhoneLocal, senderPhoneIntl])]

    const { data: memberMatch } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', instructorProfile.id)
      .in('phone', phoneVariants)
      .maybeSingle()

    if (memberMatch) {
      senderKind = 'member'
      senderRefId = memberMatch.id
    } else {
      const { data: contactMatch } = await supabase
        .from('community_contacts')
        .select('id, class_type')
        .eq('user_id', instructorProfile.id)
        .in('phone', phoneVariants)
        .maybeSingle()

      if (contactMatch) {
        senderKind = 'community_contact'
        senderRefId = contactMatch.id
        senderClassType = contactMatch.class_type ?? null
      } else {
        const { data: regMatch } = await supabase
          .from('registrations')
          .select('id, classes(type)')
          .eq('user_id', instructorProfile.id)
          .in('registrant_phone', phoneVariants)
          .order('registered_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (regMatch) {
          senderKind = 'registrant'
          senderRefId = regMatch.id
          senderClassType = ((regMatch.classes as { type?: string } | null)?.type ?? null) as ClassType | null
        }
      }
    }
  }

  // ── Ambil data instruktur untuk konteks AI ────────────────────────────────
  const [{ data: classes }, { data: events }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, slug, name, type, day_of_week, start_time, end_time, location, google_maps_url, capacity, class_price')
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

  // ── Context Filtering per Komunitas ───────────────────────────────────────
  // Urutan kekuatan sinyal: pesan menyebut tipe lain secara eksplisit (menang
  // mutlak - ini yang dianggap "bertanya lintas komunitas") → class_type dari
  // resolusi pengirim (community_contact/registrant) → kalau member tanpa
  // sinyal di atas, diturunkan dari riwayat kehadiran (attendance_summary,
  // tipe yang paling sering diikuti) → kalau tidak ada sinyal sama sekali,
  // tidak ada pembatasan (perilaku lama, tampil semua). Event TIDAK pernah
  // dibatasi - event bersifat studio-level, bukan per-komunitas.
  const explicitClassType = detectExplicitClassType(message)
  let effectiveClassType: ClassType | null = explicitClassType ?? senderClassType

  if (!effectiveClassType && senderKind === 'member' && senderRefId) {
    const { data: attendanceRows } = await supabase
      .from('attendance_summary')
      .select('class_type')
      .eq('member_id', senderRefId)
    const counts: Record<string, number> = {}
    ;(attendanceRows ?? []).forEach((r: any) => {
      if (r.class_type) counts[r.class_type] = (counts[r.class_type] ?? 0) + 1
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    effectiveClassType = (top?.[0] as ClassType) ?? null
  }

  const communityScopedClasses = effectiveClassType
    ? (classes ?? []).filter((c: any) => c.type === effectiveClassType)
    : (classes ?? [])
  // Fallback aman: kalau hasil filter kosong (mis. tipe yang terdeteksi sudah
  // tidak ada kelasnya lagi), jangan sampai bot bilang "tidak ada kelas" -
  // tampilkan semua saja seperti sebelum ada filter ini.
  const finalScopedClasses = communityScopedClasses.length > 0 ? communityScopedClasses : (classes ?? [])

  const studioName = instructorProfile.business_name ?? instructorProfile.name
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const slug = instructorProfile.slug ?? ''

  const now = new Date()
  const todayLabel = `${DAY_NAMES[now.getDay()]}, ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`

  // Nomor pribadi instruktur (beda dari nomor bot) - dipakai untuk fallback
  // "hubungi langsung" yang sebenarnya mengarah ke kontak lain, bukan ke
  // nomor bot yang sedang dipakai untuk chat ini.
  const personalPhone = instructorProfile.phone ? normalizePhone(instructorProfile.phone) : null
  const hasDistinctPersonalPhone = !!personalPhone && personalPhone !== cleanDevice

  // Sapaan "Kak" - selalu pakai ini, plus nama kalau Fonnte kasih nama kontaknya
  const greetName = senderName ? `Kak ${senderName}` : 'Kak'

  const titleLines = Object.entries(TYPE_TITLE)
    .map(([type, title]) => `- ${type[0].toUpperCase()}${type.slice(1)} → "${title} ${instructorProfile.name}"`)
    .join('\n')

  // ── Riwayat percakapan thread ini (instruktur + nomor pengirim) ────────────
  // senderPhoneKey sudah dihitung di blok debounce di atas - dipakai ulang
  // di sini supaya konsisten dengan kunci yang dipakai wa_message_buffer.
  const { data: historyRows } = await supabase
    .from('wa_conversations')
    .select('role, message, created_at')
    .eq('user_id', instructorProfile.id)
    .eq('phone', senderPhoneKey)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const history = (historyRows ?? []).reverse()

  // ── Kesadaran waktu sejak balasan terakhir ──────────────────────────────
  // Tanpa ini, bot tidak bisa beda-bedakan "ok" yang datang 10 detik vs 2
  // jam setelah tawaran terakhirnya - keduanya kelihatan identik di riwayat
  // teks polos. minutesSinceLast dipakai utk 2 hal: (1) fast-path balasan
  // penutup singkat di bawah, (2) konteks tambahan di system prompt Claude
  // supaya AI sendiri yang menilai kasus-kasus di luar pola regex yang jelas.
  const lastHistoryMsg = history[history.length - 1] as { role: string; message: string; created_at: string } | undefined
  const minutesSinceLast = lastHistoryMsg
    ? (now.getTime() - new Date(lastHistoryMsg.created_at).getTime()) / 60000
    : null

  // "Obrolan baru" = belum pernah chat sama sekali, ATAU jeda dari balasan
  // terakhir sudah lama - dipakai supaya bot tidak menyapa "Halo Kak!"
  // berulang-ulang di setiap balasan saat obrolan masih berjalan terus
  // (jadwal → harga → lokasi beruntun), yang kelihatan robotic dibanding
  // obrolan manusia asli yang cuma menyapa sekali di awal.
  const GREET_RESET_MINUTES = 45
  const isFreshThread = history.length === 0 || (minutesSinceLast !== null && minutesSinceLast > GREET_RESET_MINUTES)
  const greetPrefix = isFreshThread ? `Halo ${greetName}! ` : ''

  // ── Fast-path: balasan penutup singkat ("ok"/"oke"/"sip"/"makasih" dst) ──
  // Tanpa cek jeda waktu, balasan penutup yang datang lama setelah tawaran
  // terakhir bisa disalahartikan sebagai konfirmasi tawaran BASI itu (lihat
  // kasus nyata: peserta jawab "ok" 1.5 jam setelah bot menawarkan event,
  // bot malah kirim ulang link & info seolah baru saja ditawarkan). Kalau
  // jeda sudah lewat ACK_STALE_MINUTES, anggap ini cuma penutup obrolan -
  // balas singkat, JANGAN lanjut ke Claude (yang masih bisa "tergoda"
  // melanjutkan konteks lama).
  const ACK_STALE_MINUTES = 15
  const isShortAck = /^(ok(e|ay)?|s?iap|baik|noted|makasih|terima\s*kasih|thanks?|trims?|sip)(\s+kaka?)?[\s!.,🙏👍😊]*$/iu.test(message.trim())
  if (isShortAck && minutesSinceLast !== null && minutesSinceLast > ACK_STALE_MINUTES) {
    return sendFastReply(`Siap, ${greetName} 🙏`)
  }

  function formatClassLine(c: any) {
    const price = Number(c.class_price) > 0 ? formatRupiah(Number(c.class_price)) : 'Gratis'
    const regLink = slug ? `${appUrl}/${slug}/daftar/kelas/${c.slug ?? c.id}` : '(link belum tersedia)'
    return `- *${c.name}* (${c.type}): ${DAY_NAMES[c.day_of_week]}, ${formatTime(c.start_time)}–${formatTime(c.end_time)}` +
      `${c.location ? ` di ${c.location}` : ''}` +
      `${c.capacity ? ` (maks ${c.capacity} orang)` : ''}\n` +
      `  Harga: ${price}\n  Daftar: ${regLink}`
  }

  const classLines = finalScopedClasses.map(formatClassLine).join('\n\n') || '- (belum ada kelas terdaftar)'

  const eventLines = (events ?? []).map((e: any) => {
    const ebAvail = Number(e.early_bird_price) > 0 &&
      e.early_bird_deadline &&
      new Date(e.early_bird_deadline) > new Date()
    const price = ebAvail
      ? `Early Bird ${formatRupiah(Number(e.early_bird_price))} / OTS ${formatRupiah(Number(e.ots_price))}`
      : `${formatRupiah(Number(e.ots_price))}`
    const regLink = slug ? `${appUrl}/${slug}/daftar/${e.slug}` : '(link belum tersedia)'
    return `- *${e.title}* - ${e.event_date} pukul ${formatTime(e.start_time)}` +
      `${e.location ? ` di ${e.location}` : ''}\n  Harga: ${price}\n  Daftar: ${regLink}` +
      (e.description ? `\n  Info: ${e.description}` : '')
  }).join('\n\n') || '- (tidak ada event mendatang)'

  // Kirim balasan deterministik (tanpa panggil Claude), simpan ke riwayat,
  // lalu selesai. Dipakai semua fast-path di bawah (jadwal & laporan).
  async function sendFastReply(text: string) {
    await supabase.from('wa_conversations').insert([
      { user_id: instructorProfile.id, phone: senderPhoneKey, role: 'user', message, sender_kind: senderKind, sender_ref_id: senderRefId, class_type: senderClassType },
      { user_id: instructorProfile.id, phone: senderPhoneKey, role: 'assistant', message: text, sender_kind: senderKind, sender_ref_id: senderRefId, class_type: senderClassType },
    ])
    const senderPhone = cleanSender.startsWith('62') ? '0' + cleanSender.slice(2) : cleanSender
    await sendWhatsApp(senderPhone, text, instructorProfile.fonnte_token ?? null)
    return NextResponse.json({ ok: true, fastPath: true })
  }

  // ── Laporan khusus instruktur (read-only) - hanya aktif kalau pengirim
  // adalah nomor pribadi instruktur sendiri, BUKAN calon member/peserta yang
  // sedang chat ke bot. Mencegah orang luar minta data peserta/member orang.
  const isInstructorSender = !!personalPhone && cleanSender === personalPhone
  if (isInstructorSender) {
    // 1) Peserta kelas tertentu - "siapa yang daftar kelas Barre", "peserta poundfit"
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
          return `*${c.name}* - ${formatDate(targetDate)}\n${lines}\nTotal: ${regs?.length ?? 0} orang`
        }))
        return sendFastReply(`Halo Kak! 📋 Ini daftar peserta yang Kakak minta:\n\n${blocks.join('\n\n')}`)
      }
    }

    // 2) Absensi/kehadiran hari ini - "absensi hari ini", "siapa yang hadir"
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

    // 3) Ringkasan member - "berapa member aktif", "member at risk"
    if (/berapa\s+member|member\s+aktif|member\s+at.?risk|jumlah\s+member/i.test(message)) {
      const [{ count: total }, { count: active }, { count: atRisk }, { count: inactive }] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id),
        supabase.from('member_summary').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id).eq('status', 'active'),
        supabase.from('member_summary').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id).eq('status', 'at_risk'),
        supabase.from('member_summary').select('id', { count: 'exact', head: true }).eq('user_id', instructorProfile.id).eq('status', 'inactive'),
      ])
      return sendFastReply(
        `Halo Kak! 📋 Ringkasan member:\n\n` +
        `Total: ${total ?? 0} member\n` +
        `✅ Aktif: ${active ?? 0}\n` +
        `⚠️ Perlu Follow Up: ${atRisk ?? 0}\n` +
        `💤 Tidak aktif: ${inactive ?? 0}`
      )
    }
  }

  // ── Fast-path: pertanyaan jadwal dijawab langsung tanpa panggil Claude ──────
  // Ini intent paling sering & jawabannya selalu sama (daftar kelas/event apa
  // adanya) - daripada bayar token Claude + tunggu API tiap kali, langsung
  // kirim data jadwal yang sudah disusun di atas. AI tetap dipakai untuk
  // pertanyaan lain (termasuk follow-up setelah fast-path ini, karena balasan
  // ini juga disimpan ke riwayat).
  const isScheduleQuery = /\bjadwal\b|kelas apa (aja|saja)|ada kelas apa/i.test(message)
  if (isScheduleQuery) {
    const asksToday = /hari ini/i.test(message)
    const todayClasses = finalScopedClasses.filter((c: any) => c.day_of_week === now.getDay())
    const scopedClasses = asksToday ? todayClasses : finalScopedClasses
    const scopedLines = scopedClasses.length > 0
      ? scopedClasses.map(formatClassLine).join('\n\n')
      : (asksToday ? '- (tidak ada kelas hari ini)' : '- (belum ada kelas terdaftar)')

    const fastReply =
      `${greetPrefix}👋 ${asksToday ? `Jadwal hari ini (${todayLabel}):` : `Ini jadwal kelas di *${studioName}*:`}\n\n${scopedLines}` +
      (!asksToday && events && events.length > 0 ? `\n\nEvent mendatang:\n\n${eventLines}` : '') +
      `\n\nMau daftar kelas/event yang mana, Kak? Tinggal sebutin aja ya 😊`

    return sendFastReply(fastReply)
  }

  // ── Fast-path: harga ─────────────────────────────────────────────────────
  if (/harga|biaya|berapa.*(bayar|harga)/i.test(message)) {
    const lines = finalScopedClasses
      .map((c: any) => `- *${c.name}*: ${Number(c.class_price) > 0 ? formatRupiah(Number(c.class_price)) : 'Gratis'}`)
      .join('\n') || '- (belum ada info harga)'
    return sendFastReply(`${greetPrefix}💰 Ini info harganya:\n\n${lines}\n\nMau daftar yang mana, Kak? 😊`)
  }

  // ── Fast-path: lokasi ────────────────────────────────────────────────────
  if (/lokasi|alamat|dimana|di\s*mana/i.test(message)) {
    const lines = finalScopedClasses
      .map((c: any) => `- *${c.name}*: ${c.location ?? '(lokasi belum diisi)'}${c.google_maps_url ? `\n  ${c.google_maps_url}` : ''}`)
      .join('\n') || '- (belum ada info lokasi)'
    return sendFastReply(`${greetPrefix}📍 Ini lokasinya:\n\n${lines}`)
  }

  // ── Fast-path: link komunitas ───────────────────────────────────────────
  // Sebelumnya ini "bug fungsional" - Claude diinstruksikan jawab ramah soal
  // gabung komunitas, tapi wa_invite_link TIDAK PERNAH ada di context-nya,
  // jadi tidak mungkin kasih link yang benar. Sekarang dijawab deterministik
  // langsung dari class_type_benefits. Kalau tidak ada link yang cocok sama
  // sekali, fallback ke Claude seperti sebelumnya (tidak return).
  if (/gabung.*(grup|komunitas)|join.*(grup|komunitas)/i.test(message)) {
    const { data: benefits } = await supabase
      .from('class_type_benefits')
      .select('type, wa_invite_link')
      .eq('user_id', instructorProfile.id)
      .not('wa_invite_link', 'is', null)

    const list = benefits ?? []
    const matched = effectiveClassType ? list.find((b: any) => b.type === effectiveClassType) : null

    if (matched) {
      return sendFastReply(`${greetPrefix}🙌 Yuk gabung komunitas kita, klik link ini ya:\n${matched.wa_invite_link}`)
    } else if (list.length === 1) {
      return sendFastReply(`${greetPrefix}🙌 Yuk gabung komunitas kita, klik link ini ya:\n${(list[0] as any).wa_invite_link}`)
    } else if (list.length > 1) {
      const lines = list.map((b: any) =>
        `- ${CLASS_TYPES.find(t => t.value === b.type)?.label ?? b.type}: ${b.wa_invite_link}`
      ).join('\n')
      return sendFastReply(`${greetPrefix}🙌 Kita punya beberapa komunitas, pilih sesuai kelasmu ya:\n\n${lines}`)
    }
    // list.length === 0 → belum ada link dikonfigurasi sama sekali, lanjut ke Claude (perilaku lama).
  }

  // ── Fast-path: event terdekat ────────────────────────────────────────────
  if (/event apa|ada\s*event|event\s*(terdekat|mendatang)/i.test(message)) {
    return sendFastReply(`${greetPrefix}🎉 Ini event mendatang:\n\n${eventLines}`)
  }

  // ── Handover ke instruktur ───────────────────────────────────────────────
  // Komplain/cedera/refund/berhenti member bukan FAQ - bot tidak boleh "sok
  // jawab". Klasifikasi pakai panggilan Claude TERPISAH dan KHUSUS (bukan
  // systemPrompt utama di bawah, yang tetap tidak diubah) - kalau positif,
  // langsung balas template + notifikasi WA ke nomor pribadi instruktur,
  // tanpa pernah masuk ke alur jawab-pertanyaan biasa.
  const needsHandover = await classifyHandover(message)
  if (needsHandover) {
    if (hasDistinctPersonalPhone && instructorProfile.phone) {
      const notifyText =
        `🔔 *Perlu perhatian Anda*\n\n` +
        `Dari: ${senderName ? `${senderName} (${cleanSender})` : cleanSender}\n` +
        `Pesan: "${message}"`
      await sendWhatsApp(instructorProfile.phone, notifyText, instructorProfile.fonnte_token ?? null)
    }
    return sendFastReply(`Baik ${greetName}, aku teruskan ke ${instructorProfile.name} ya 🙏`)
  }

  const systemPrompt =
    `Kamu adalah asisten WhatsApp untuk *${studioName}*, studio fitness yang dikelola oleh ${instructorProfile.name}.

INFORMASI STUDIO:
- Nama: ${studioName}
- Instruktur: ${instructorProfile.name}
- Hari ini: ${todayLabel}
- Halaman publik: ${appUrl}/${slug}
- Status obrolan: ${isFreshThread ? 'AWAL OBROLAN BARU (belum pernah chat, atau sudah lama tidak chat)' : `LANJUTAN OBROLAN YANG MASIH BERJALAN (balasanmu terakhir ke peserta ini ${formatElapsed(minutesSinceLast ?? 0)} yang lalu)`}

JADWAL KELAS RUTIN:
${classLines}

EVENT MENDATANG:
${eventLines}

GELAR INSTRUKTUR PER TIPE KELAS (sebut instruktur dengan gelar ini kalau lagi ngomongin kelas tipe itu, bukan cuma nama polos):
${titleLines}
- Tipe lain → "${instructorProfile.name}" saja (tanpa gelar)

CARA MENJAWAB:
- WAJIB selalu panggil orang yang chat dengan sebutan "Kak" - contoh: "Halo ${greetName}!", "Boleh, Kak!", "Siap, Kak 😊". Jangan pernah panggil nama tanpa "Kak" di depannya
- Soal sapaan "Halo Kak ...!" di awal balasan: HANYA pakai kalau status obrolan di atas "AWAL OBROLAN BARU". Kalau statusnya "LANJUTAN OBROLAN YANG MASIH BERJALAN", JANGAN sapa "Halo Kak!" lagi - langsung ke isi jawaban, supaya tidak kelihatan seperti mengulang skrip robot di setiap balasan
- Kalau status "LANJUTAN OBROLAN" TAPI jeda yang disebutkan di atas sudah cukup lama (lebih dari sekitar 30 menit) dan peserta cuma membalas singkat tanpa pertanyaan baru (mis. "ok", "sip", "noted", "boleh", emoji jempol) - JANGAN otomatis melanjutkan atau mengulang tawaran/info/link dari balasanmu sebelumnya. Anggap obrolan sebelumnya sudah selesai, balas santai dan singkat saja tanpa mengulang apa pun yang sudah kamu kirim
- Selalu bersikap suportif, hangat, dan memotivasi - buat orang yang chat merasa dihargai dan disambut baik, bukan dilayani robot
- Gunakan Bahasa Indonesia yang ramah dan santai, emoji secukupnya
- Jawaban ringkas (idealnya 3-5 kalimat), TAPI kalau ada lebih dari satu topik/konteks dalam satu balasan, pisah jadi paragraf baru (baris kosong) per topik - jangan ditumpuk jadi satu paragraf panjang, supaya nyaman dibaca di WhatsApp
- PENTING soal format bold: WhatsApp cuma pakai SATU tanda bintang untuk tebal (*teks*) - JANGAN PERNAH pakai dua bintang (**teks**) seperti markdown biasa, itu akan tampil rusak
- Kamu SUDAH TAHU hari ini hari apa (lihat "Hari ini" di atas) - jangan pernah tanya balik hari/tanggal ke peserta, langsung cocokkan ke jadwal kelas yang sesuai
- Untuk pertanyaan jadwal atau event → berikan info yang ada di atas
- Kalau orang menyatakan niat daftar/ikut kelas atau event TERTENTU, cocokkan namanya dengan data di atas dan balas dengan link "Daftar" yang SESUAI dengan item itu - jangan sampai ketuker kasih link kelas/event lain
- Kalau tidak jelas kelas/event mana yang dimaksud (nama disebut umum, atau ada beberapa kandidat yang cocok), tanya dulu mau yang mana sebelum kasih link apa pun - jangan menebak
- Kalau cuma tanya-tanya info tanpa niat daftar, jawab informatif saja tanpa otomatis menyodorkan link
- Kalau orang bilang mau "gabung komunitas"/"join grup" - ini BUKAN niat daftar kelas/event, jangan cocokkan ke kelas manapun dan jangan kasih link registrasi. Cukup jawab ramah dan arahkan sesuai instruksi kontak di bawah
- Kalau ditanya soal sisa slot/kuota/apakah masih ada tempat kosong untuk kelas atau event TERTENTU - jumlah peserta real-time TIDAK ada di data di atas (bisa berubah tiap saat, jadi sengaja tidak ditulis di sini), TAPI selalu bisa dilihat langsung di link "Daftar" kelas/event itu (halamannya menampilkan sisa kuota secara real-time). Arahkan ke link itu - JANGAN bilang tidak tahu, dan JANGAN langsung suruh hubungi instruktur untuk hal ini
- Jika pertanyaan lain tidak bisa dijawab dari data di atas, tapi kemungkinan infonya ada di halaman publik (jadwal lengkap, harga, lokasi, cara daftar, dll) → arahkan ke ${appUrl}/${slug} dulu
- Hanya kalau pertanyaan benar-benar tidak ada infonya sama sekali (baik di data di atas maupun halaman publik)${hasDistinctPersonalPhone ? `, atau orang minta ngobrol langsung dengan manusia` : ''} → ${hasDistinctPersonalPhone ? `sarankan hubungi ${instructorProfile.name} langsung di ${instructorProfile.phone} (nomor pribadi, beda dari nomor chat ini)` : `sarankan hubungi ${instructorProfile.name} langsung`}
- JANGAN membuat info, harga, atau jadwal yang tidak ada di data di atas
- Mulai jawaban langsung tanpa sapaan panjang`

  // ── Panggil Claude AI (dengan riwayat percakapan thread ini) ────────────────
  let reply = ''
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const userMsg = senderName ? `[${senderName}]: ${message}` : message

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.message })),
        { role: 'user', content: userMsg },
      ],
    })

    reply = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    // Jaga-jaga kalau model tetap pakai markdown dua bintang - WhatsApp cuma
    // kenal satu bintang untuk bold, dua bintang tampil rusak (bintangnya
    // ikut kelihatan).
    reply = reply.replace(/\*\*/g, '*')
  } catch (err) {
    console.error('[WA Bot] Claude error:', err)
    reply = `Halo ${greetName}! Maaf ya, asisten kami sedang sibuk 🙏 Silakan hubungi ${instructorProfile.name} langsung ya 😊`
  }

  // ── Simpan riwayat (pesan masuk + balasan) ──────────────────────────────────
  await supabase.from('wa_conversations').insert([
    { user_id: instructorProfile.id, phone: senderPhoneKey, role: 'user', message, sender_kind: senderKind, sender_ref_id: senderRefId, class_type: senderClassType },
    ...(reply ? [{ user_id: instructorProfile.id, phone: senderPhoneKey, role: 'assistant', message: reply, sender_kind: senderKind, sender_ref_id: senderRefId, class_type: senderClassType }] : []),
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
