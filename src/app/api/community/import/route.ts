import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CLASS_TYPES } from '@/lib/constants'

interface ImportRow {
  name: string
  phone: string
  classType: string
}

const TYPE_VALUES = new Set(CLASS_TYPES.map(t => t.value))
const TYPE_BY_LABEL = new Map(CLASS_TYPES.map(t => [t.label.toLowerCase(), t.value]))

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('62') ? '0' + digits.slice(2) : digits
}

type ClassType = 'zumba' | 'yoga' | 'pilates' | 'poundfit' | 'aerobic' | 'barre' | 'other'

function resolveClassType(raw: string): { value: ClassType | null; invalid: boolean } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: null, invalid: false }
  const lower = trimmed.toLowerCase()
  if (TYPE_VALUES.has(lower as never)) return { value: lower as ClassType, invalid: false }
  const byLabel = TYPE_BY_LABEL.get(lower)
  if (byLabel) return { value: byLabel as ClassType, invalid: false }
  return { value: null, invalid: true }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await request.json().catch(() => ({ rows: null }))
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Tidak ada baris untuk diimpor' }, { status: 400 })
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: 'Maksimal 1000 baris per import' }, { status: 400 })
  }

  // Baca kontak existing sekali untuk dedupe by (phone, class_type) - sesuai
  // keputusan: nomor yang sama untuk tipe komunitas yang sama dilewati,
  // bukan ditimpa atau diduplikasi.
  const { data: existingRows } = await supabase
    .from('community_contacts')
    .select('phone, class_type')
    .eq('user_id', user.id)

  const existingKeys = new Set(
    (existingRows ?? []).map((r: { phone: string | null; class_type: string | null }) =>
      `${r.phone ?? ''}|${r.class_type ?? ''}`
    )
  )

  const toInsert: { user_id: string; name: string | null; phone: string | null; class_type: ClassType | null; source: string }[] = []
  const invalid: { row: number; reason: string }[] = []
  let skippedDuplicate = 0
  const seenInBatch = new Set<string>()

  rows.forEach((r: ImportRow, i: number) => {
    const rowNum = i + 2 // +1 header, +1 ke-1-based
    const name = String(r.name ?? '').trim()
    const phoneRaw = String(r.phone ?? '').trim()
    const phone = phoneRaw ? normalizePhone(phoneRaw) : ''

    if (!name && !phone) {
      invalid.push({ row: rowNum, reason: 'Baris kosong (tidak ada nama maupun nomor HP)' })
      return
    }
    if (phoneRaw && phone.length < 9) {
      invalid.push({ row: rowNum, reason: `Nomor HP tidak valid: "${phoneRaw}"` })
      return
    }

    const { value: classType, invalid: typeInvalid } = resolveClassType(String(r.classType ?? ''))
    if (typeInvalid) {
      invalid.push({ row: rowNum, reason: `Tipe komunitas tidak dikenali: "${r.classType}"` })
      return
    }

    const key = `${phone}|${classType ?? ''}`
    if (phone && (existingKeys.has(key) || seenInBatch.has(key))) {
      skippedDuplicate++
      return
    }
    if (phone) seenInBatch.add(key)

    toInsert.push({
      user_id:    user.id,
      name:       name || null,
      phone:      phone || null,
      class_type: classType,
      source:     'import',
    })
  })

  let inserted = 0
  if (toInsert.length > 0) {
    const { error, count } = await supabase
      .from('community_contacts')
      .insert(toInsert, { count: 'exact' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted = count ?? toInsert.length
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skippedDuplicate,
    invalid,
  })
}
