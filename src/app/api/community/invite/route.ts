import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/community/invite
 * Body: { candidateIds: string[] } — bisa 1 atau banyak
 *
 * Flow:
 * 1. Fetch kandidat + wa_invite_link dari class_type_benefits
 * 2. Kirim WA via Fonnte per kandidat
 * 3. Update status → 'invited', set invited_at
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { candidateIds } = await req.json() as { candidateIds: string[] }
  if (!candidateIds?.length) {
    return NextResponse.json({ error: 'candidateIds wajib diisi' }, { status: 400 })
  }

  // Fetch profil instruktur (untuk token Fonnte dan nama)
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('name, business_name, fonnte_token, bot_phone')
    .eq('id', user.id)
    .single()

  if (!profile?.fonnte_token) {
    return NextResponse.json({ error: 'WhatsApp belum terhubung. Hubungkan WA di Pengaturan terlebih dahulu.' }, { status: 400 })
  }

  // Fetch kandidat
  const { data: candidates, error: candErr } = await (supabase
    .from('community_invitation_candidates') as any)
    .select('id, name, phone, class_type, status')
    .in('id', candidateIds)
    .eq('user_id', user.id)
    .neq('status', 'invited')  // skip yang sudah diundang

  if (candErr || !candidates?.length) {
    return NextResponse.json({ error: 'Kandidat tidak ditemukan' }, { status: 404 })
  }

  // Fetch wa_invite_link per class_type yang dibutuhkan
  const classTypes   = [...new Set((candidates as any[]).map((c: any) => c.class_type))]
  const { data: benefits } = await (supabase.from('class_type_benefits') as any)
    .select('type, wa_invite_link')
    .eq('user_id', user.id)
    .in('type', classTypes)

  const linkMap = Object.fromEntries(
    ((benefits ?? []) as any[]).map((b: any) => [b.type, b.wa_invite_link])
  )

  // Kirim WA via Fonnte + update status
  const results: { id: string; success: boolean; error?: string }[] = []
  const now = new Date().toISOString()
  const instructorName = profile.business_name ?? profile.name ?? 'Instruktur'

  for (const candidate of candidates as any[]) {
    const inviteLink = linkMap[candidate.class_type]

    if (!inviteLink) {
      results.push({ id: candidate.id, success: false, error: `Link komunitas ${candidate.class_type} belum diisi` })
      continue
    }

    const CLASS_TYPE_LABEL: Record<string, string> = {
      barre: 'Barre', poundfit: 'Poundfit', yoga: 'Yoga',
      pilates: 'Pilates', zumba: 'Zumba', aerobic: 'Aerobic', other: 'Kelas',
    }
    const classLabel = CLASS_TYPE_LABEL[candidate.class_type] ?? candidate.class_type

    const message =
`Halo ${candidate.name} 👋

Terima kasih sudah mengikuti kelas ${classLabel} bersama ${instructorName}.

Agar tidak ketinggalan jadwal kelas, promo, dan event berikutnya, silakan bergabung ke komunitas kami:

${inviteLink}

Sampai jumpa di kelas berikutnya 💜`

    // Kirim via Fonnte
    const phoneFormatted = candidate.phone.replace(/\D/g, '').replace(/^0/, '62')
    try {
      const fonnteRes = await fetch('https://api.fonnte.com/send', {
        method:  'POST',
        headers: {
          'Authorization': profile.fonnte_token,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          target:  phoneFormatted,
          message,
          delay:   0,
          countryCode: '62',
        }),
      })
      const fonnteData = await fonnteRes.json()

      if (fonnteData.status) {
        // Sukses — update status
        await (supabase.from('community_invitation_candidates') as any)
          .update({ status: 'invited', invited_at: now })
          .eq('id', candidate.id)
        results.push({ id: candidate.id, success: true })
      } else {
        results.push({ id: candidate.id, success: false, error: fonnteData.reason ?? 'Gagal kirim WA' })
      }
    } catch (e: any) {
      results.push({ id: candidate.id, success: false, error: e.message })
    }
  }

  const successCount = results.filter(r => r.success).length
  return NextResponse.json({ results, successCount })
}
