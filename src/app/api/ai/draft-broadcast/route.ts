import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const AUDIENCE_LABEL: Record<string, string> = {
  all:      'semua member',
  active:   'member yang aktif dan rajin hadir',
  at_risk:  'member yang sudah mulai jarang hadir dan perlu motivasi',
  inactive: 'member yang sudah lama tidak hadir',
  new:      'member baru yang baru bergabung',
}

export async function POST(request: Request) {
  try {
    const { audience = 'all', title = '' } = await request.json()

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const audienceDesc = AUDIENCE_LABEL[audience] ?? 'semua member'
    const topicHint    = title ? ` dengan topik/tema: "${title}"` : ''

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role:    'user',
        content: `Kamu adalah asisten instruktur fitness Indonesia yang membantu menulis pesan WhatsApp broadcast.

Tulis pesan untuk dikirim ke ${audienceDesc}${topicHint}.

Panduan penulisan:
- Bahasa Indonesia yang hangat, semangat, dan natural
- Maksimal 3 paragraf singkat (total ±150 kata)
- Cocok dibaca di WhatsApp (tidak kaku, tidak terlalu formal)
- Boleh pakai 2-3 emoji yang relevan
- JANGAN pakai markdown (bukan *bold* atau _italic_)
- Akhiri dengan satu kalimat ajakan (CTA) yang jelas
- Tulis langsung isi pesannya saja, tanpa pembuka seperti "Berikut pesannya:" atau penjelasan apapun`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return NextResponse.json({ content: text })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Gagal membuat draft.' },
      { status: 500 }
    )
  }
}
