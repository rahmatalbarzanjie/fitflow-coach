/**
 * Panggil ini setelah mutasi client-side yang memengaruhi angka di Beranda
 * (registrations, members, attendance, classes, events, community_invitation_
 * candidates) - membuang cache server-side `beranda-${userId}` (lihat
 * src/app/(dashboard)/beranda/page.tsx) supaya kunjungan berikutnya ke
 * Beranda dapat data baru, bukan menunggu TTL 45 detik.
 *
 * Fire-and-forget: gagal invalidasi tidak boleh blokir UI mutasi utama.
 *
 * Tanpa argumen = dipanggil dari dalam dashboard (sesi login ada, route
 * tahu user-nya siapa). Dengan { eventId } / { classId } = dipanggil dari
 * halaman pendaftaran publik (peserta belum login) - route mencari
 * pemilik event/class lewat service client.
 */
export function invalidateDashboardCache(target?: { eventId?: string; classId?: string }) {
  return fetch('/api/cache/revalidate-dashboard', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(target ?? {}),
  }).catch(() => {})
}
