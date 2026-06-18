import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TYPE_LABEL: Record<string, string> = {
  caption_foto:  'Caption Foto Kelas',
  caption_video: 'Caption Video / Reels',
  quote:         'Quote Motivasi',
  promosi_event: 'Promosi Event',
}

const MOOD_LABEL: Record<string, string> = {
  semangat:   'Semangat 💪',
  hangat:     'Hangat 😊',
  inspiratif: 'Inspiratif ✨',
  santai:     'Santai 😄',
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type, mood, context } = await request.json()
    if (!type || !mood) return NextResponse.json({ error: 'type dan mood wajib diisi' }, { status: 400 })

    // Fetch instructor name & studio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('name, business_name')
      .eq('id', user.id)
      .single()

    const instructorName = profile?.name ?? 'Instruktur'
    const studioName     = profile?.business_name ?? profile?.name ?? 'Studio Fitness'

    const systemPrompt = `Kamu adalah asisten konten media sosial untuk instruktur fitness Indonesia bernama ${instructorName} yang mengajar di studio bernama ${studioName}.

KARAKTER PENULISAN:
- Tulis seperti instruktur fitness Indonesia yang genuine dan hangat, bukan brand besar
- Bahasa: campuran Indonesia-Inggris yang natural (seperti orang Indonesia biasa nulis di IG)
- Jangan terlalu formal, jangan terlalu alay
- Boleh pakai kata: "Alhamdulillah", "yuk", "dong", "banget", "sih", "nih", "kak"
- Boleh pakai kata Inggris natural: "full effort", "proud of you", "keep going", "vibes", "worth it"
- Jangan pakai kata: "mari kita", "kami", "dapatkan", "segera", "jangan lewatkan" - terlalu salesy

ATURAN PER PLATFORM:

Instagram Feed (caption panjang 150-300 kata):
- Baris pertama = hook kuat (buat orang berhenti scroll)
- Ada cerita atau insight kecil di tengah
- CTA di akhir (cek bio, DM, dll)
- Emoji secukupnya - jangan setiap kalimat
- Paragraf pendek, ada line break

TikTok/Reels (caption pendek 30-50 kata):
- Hook 1 baris pertama yang bikin orang nonton
- Format: POV: / Ketika kamu / Ini yang terjadi ketika...
- Energik, punchy, ada kata kunci yang trending
- Max 3-4 baris total

WhatsApp Story (teks singkat 30-50 kata):
- Santai, seperti update ke teman
- Personal, tidak perlu CTA yang keras
- Boleh pakai "Alhamdulillah" di awal
- Emoji terbatas (2-3 saja)

MOOD GUIDE:
- Semangat 💪: energik, exclamation, kata power
- Hangat 😊: personal, grateful, inclusive, "kita"
- Inspiratif ✨: thoughtful, ada insight, lebih dalam
- Santai 😄: conversational, humor ringan, relatable

PENTING:
- Selalu sebutkan nama kelas jika ada dalam konteks
- Selalu ada CTA untuk kelas berikutnya atau cek jadwal
- Jangan buat caption yang terasa copy-paste atau template
- Variasikan struktur kalimat - jangan semua pakai pola sama
- Hasil harus terasa ditulis manusia, bukan AI

OUTPUT FORMAT (JSON):
{
  "instagram": "caption lengkap untuk IG feed",
  "tiktok": "caption pendek untuk TikTok/Reels",
  "whatsapp": "teks untuk WA Story",
  "hashtags": ["hashtag1", "hashtag2", ...] (8-12 hashtag, mix populer dan niche, selalu include nama kota instruktur)
}

Jangan tambahkan penjelasan apapun di luar JSON.`

    const userMessage = `Jenis konten: ${TYPE_LABEL[type] ?? type}
Mood: ${MOOD_LABEL[mood] ?? mood}${context ? `\nKonteks tambahan: ${context}` : ''}`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const aiResponse = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const rawText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text.trim() : ''

    // Parse JSON - strip optional markdown code fence
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI tidak menghasilkan JSON yang valid')
    const result = JSON.parse(jsonMatch[0]) as {
      instagram: string; tiktok: string; whatsapp: string; hashtags: string[]
    }

    // Save to ai_requests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: historyItem } = await (supabase.from('ai_requests') as any)
      .insert({
        user_id:  user.id,
        type:     'generate_content',
        prompt:   JSON.stringify({ type, mood, context: context ?? '' }),
        response: JSON.stringify(result),
      })
      .select('id, created_at, prompt, response')
      .single()

    return NextResponse.json({ result, historyItem })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal generate konten.'
    console.error('generate-content error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await supabase.from('ai_requests').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal hapus.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
