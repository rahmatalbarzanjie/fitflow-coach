import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Bug yang diperbaiki: Beranda (/beranda) membungkus query "Perlu
 * Perhatian"/ringkasan dengan unstable_cache(revalidate: 45) tapi TIDAK
 * PERNAH ada revalidateTag/revalidatePath di mana pun di codebase -
 * akibatnya setiap mutasi yang memengaruhi angka Dashboard (konfirmasi
 * registrasi, absensi, dst) bisa tetap menampilkan data lama sampai 45
 * detik berlalu, walau data di database sudah benar saat itu juga.
 * Lihat investigasi root-cause lengkap di percakapan terkait.
 *
 * Route ini dipanggil oleh client component (lewat invalidateDashboardCache
 * di src/lib/invalidate-dashboard.ts) setelah mutasi yang memengaruhi
 * getCachedBerandaData berhasil - cache tag-nya `beranda-${userId}`,
 * di-set per user (bukan global) supaya invalidasi satu instruktur tidak
 * ikut membuang cache instruktur lain.
 *
 * Dua mode pemanggil:
 * 1. Dari dalam dashboard (ada sesi login) - userId diambil dari sesi,
 *    BUKAN dari body, supaya satu user tidak bisa memaksa invalidasi
 *    cache user lain.
 * 2. Dari halaman pendaftaran publik (peserta belum login) - kirim
 *    eventId/classId, pemilik (user_id) dicari lewat service client.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    revalidateTag(`beranda-${user.id}`)
    return NextResponse.json({ ok: true })
  }

  const body = await req.json().catch(() => ({})) as { eventId?: string; classId?: string }
  const { eventId, classId } = body
  if (!eventId && !classId) {
    return NextResponse.json({ ok: true }) // tidak ada target, tidak ada yang perlu di-invalidate
  }

  const service = createServiceClient()
  const table = eventId ? 'events' : 'classes'
  const id    = (eventId ?? classId)!
  const { data } = await (service.from(table) as any).select('user_id').eq('id', id).single()
  if (data?.user_id) revalidateTag(`beranda-${data.user_id}`)

  return NextResponse.json({ ok: true })
}
