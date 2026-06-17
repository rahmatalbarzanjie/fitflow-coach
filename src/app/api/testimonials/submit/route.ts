import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const { memberId, rating, content } = await request.json().catch(() => ({}))

  if (!memberId || !rating || !content?.trim()) {
    return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
  }
  const ratingNum = Number(rating)
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: 'Rating tidak valid' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: member } = await supabase
    .from('members')
    .select('id, name, photo_url, user_id')
    .eq('id', memberId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member tidak ditemukan' }, { status: 404 })

  const { data: existing } = await supabase
    .from('testimonials')
    .select('id')
    .eq('member_id', memberId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Kamu sudah pernah mengirim testimoni' }, { status: 409 })
  }

  const { error } = await supabase.from('testimonials').insert({
    user_id:      (member as any).user_id,
    member_id:    memberId,
    name:         (member as any).name,
    content:      content.trim(),
    rating:       ratingNum,
    photo_url:    (member as any).photo_url ?? null,
    is_published: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
