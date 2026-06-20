'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { CLASS_TYPES } from '@/lib/constants'
import { Loader2 } from 'lucide-react'

const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export default function CommunityNewPage() {
  const router = useRouter()
  const [name,      setName     ] = useState('')
  const [phone,     setPhone    ] = useState('')
  const [classType, setClassType] = useState('')
  const [saving,    setSaving   ] = useState(false)
  const [error,     setError    ] = useState('')

  async function submit() {
    if (!name.trim() && !phone.trim()) {
      setError('Isi minimal nama atau nomor HP')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/community', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, phone, classType: classType || null }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Gagal menyimpan')
      return
    }
    router.push('/community')
    setTimeout(() => router.refresh(), 100)
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/community" title="Tambah Kontak" />

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Nama <span className="text-gray-400 font-normal">(opsional)</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nama peserta"
            className={inp}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Nomor HP <span className="text-gray-400 font-normal">(opsional)</span>
          </label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            type="tel"
            className={inp}
          />
          <p className="text-xs text-gray-400">Dipakai untuk broadcast WhatsApp</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Jenis Kelas</label>
          <select
            value={classType}
            onChange={e => setClassType(e.target.value)}
            className={inp}
          >
            <option value="">Komunitas umum (tanpa jenis kelas)</option>
            {CLASS_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400">
            Jenis kelas dipakai untuk mengelompokkan kontak ini di halaman Komunitas. Kontak manual tidak otomatis muncul di absensi — peserta baru terdeteksi setelah benar-benar hadir di kelas (member/booking/walk-in).
          </p>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Menyimpan...' : 'Simpan Kontak'}
        </button>
      </div>
    </div>
  )
}
