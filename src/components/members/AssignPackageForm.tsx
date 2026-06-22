'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah, formatDateShort } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface PackageOption {
  id: string
  name: string
  package_type: string
  total_sessions: number | null
  duration_days: number | null
  price: number
}

interface Props {
  memberId: string
  userId: string
  packages: PackageOption[]
  activeMembership: { id: string; end_date: string | null; package_name: string } | null
}

const inputClass = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

// Hitung tanggal pakai komponen Y/M/D murni via Date.UTC - kalau pakai
// `new Date(dateStr + 'T00:00:00')` lalu toISOString(), hasilnya bergeser
// mundur 1 hari untuk timezone yang lebih maju dari UTC (WIB/WITA/WIT
// semua begini) karena Date itu di-anggap waktu LOKAL lalu dikonversi ke
// UTC. Date.UTC() tidak pernah melalui interpretasi waktu lokal sama
// sekali, jadi tanggal kalendernya selalu tepat di timezone apa pun.
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

export function AssignPackageForm({ memberId, userId, packages, activeMembership }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [packageId, setPackageId] = useState(packages[0]?.id ?? '')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [price, setPrice]         = useState(packages[0]?.price ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPackage = packages.find(p => p.id === packageId)

  // Member sudah punya paket aktif tanpa tanggal berakhir (sesi tanpa batas
  // waktu) - tidak ada cara valid menjadwalkan paket baru tanpa tumpang
  // tindih. Harus dibatalkan dulu secara eksplisit dari halaman Membership.
  const blockedNoEndDate = !!activeMembership && !activeMembership.end_date
  const minStartDate = activeMembership?.end_date ? addDays(activeMembership.end_date, 1) : null

  function handlePackageChange(id: string) {
    setPackageId(id)
    const pkg = packages.find(p => p.id === id)
    if (pkg) setPrice(pkg.price)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedPackage) { setError('Pilih paket dulu'); return }
    if (blockedNoEndDate) {
      setError(`Member masih punya paket aktif (${activeMembership!.package_name}) tanpa tanggal berakhir - batalkan dulu dari halaman Membership sebelum assign paket baru.`)
      return
    }
    if (minStartDate && startDate < minStartDate) {
      setError(`Tanggal mulai harus ${formatDateShort(minStartDate)} atau setelahnya - paket aktif sekarang (${activeMembership!.package_name}) baru berakhir ${formatDateShort(activeMembership!.end_date!)}.`)
      return
    }

    setSubmitting(true)

    const endDate = selectedPackage.duration_days
      ? addDays(startDate, selectedPackage.duration_days)
      : null
    const status = activeMembership ? 'pending' : 'active'

    const { error: insertErr } = await supabase.from('member_memberships').insert({
      user_id:        userId,
      member_id:      memberId,
      package_id:     selectedPackage.id,
      package_name:   selectedPackage.name,
      package_type:   selectedPackage.package_type,
      start_date:     startDate,
      end_date:       endDate,
      total_sessions: selectedPackage.package_type === 'session_pack' ? selectedPackage.total_sessions : null,
      purchase_price: price,
      status,
    })

    if (insertErr) { setError(insertErr.message); setSubmitting(false); return }

    router.push(`/members/${memberId}/membership`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      {activeMembership && !blockedNoEndDate && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-600">
          Member masih punya paket aktif (<strong>{activeMembership.package_name}</strong>, berakhir {formatDateShort(activeMembership.end_date!)}).
          Paket baru ini akan masuk antrian ("Akan Aktif") dan otomatis aktif setelah paket sekarang berakhir.
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Pilih Paket</label>
        <select value={packageId} onChange={e => handlePackageChange(e.target.value)} className={inputClass}>
          {packages.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} - {p.package_type === 'unlimited' ? 'Unlimited' : `${p.total_sessions}x Sesi`}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Tanggal Mulai</label>
        <input
          type="date"
          value={startDate}
          min={minStartDate ?? undefined}
          onChange={e => setStartDate(e.target.value)}
          className={inputClass}
        />
        {selectedPackage?.duration_days && (
          <p className="text-xs text-gray-400">Berakhir: {formatDateShort(addDays(startDate, selectedPackage.duration_days))}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Harga Aktual (Rp)</label>
        <input
          type="number"
          min="0"
          value={price}
          onChange={e => setPrice(Number(e.target.value))}
          className={inputClass}
        />
        <p className="text-xs text-gray-400">Harga katalog: {formatRupiah(selectedPackage?.price ?? 0)} - bisa diubah kalau ada diskon</p>
      </div>

      <button
        type="submit"
        disabled={submitting || blockedNoEndDate}
        className="w-full h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? 'Menyimpan...' : activeMembership ? 'Tambahkan ke Antrian' : 'Aktifkan Paket'}
      </button>
    </form>
  )
}
