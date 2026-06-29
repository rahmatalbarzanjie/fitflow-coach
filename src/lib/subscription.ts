// Diekstrak dari settings/subscription/page.tsx (Phase 2 Review) - laporan/page.tsx
// juga butuh formula yang sama, dan import antar file route (page.tsx ke
// page.tsx) bukan pola yang sehat untuk dipertahankan, beda dari helper
// lib/ yang memang didesain untuk dipakai lintas halaman.
export function getSubscriptionLabel(status: string | null, expiresAt: string | null) {
  if (status === 'active') return { label: 'Aktif', color: 'text-green-600', sub: 'Langganan aktif' }
  if (status === 'trial') {
    if (!expiresAt) return { label: 'Trial', color: 'text-yellow-600', sub: 'Periode trial' }
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    if (days <= 0) return { label: 'Trial Berakhir', color: 'text-red-600', sub: 'Langganan diperlukan' }
    return { label: 'Trial', color: 'text-yellow-600', sub: `Berakhir ${days} hari lagi` }
  }
  return { label: 'Tidak Aktif', color: 'text-red-600', sub: 'Hubungi admin' }
}
