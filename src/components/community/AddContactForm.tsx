'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { CLASS_TYPES } from '@/lib/constants'

interface ClassTypeOption {
  value: string
  label: string
}

interface Props {
  availableTypes: ClassTypeOption[]
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function AddContactForm({ availableTypes }: Props) {
  const router = useRouter()
  const [open,      setOpen     ] = useState(false)
  const [name,      setName     ] = useState('')
  const [phone,     setPhone    ] = useState('')
  const [classType, setClassType] = useState('')
  const [saving,    setSaving   ] = useState(false)
  const [error,     setError    ] = useState('')

  function handleClose() {
    setOpen(false)
    setName(''); setPhone(''); setClassType(''); setError('')
  }

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
    handleClose()
    router.refresh()
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Tambah Kontak
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Tambah Kontak Komunitas</h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nama</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nama peserta (opsional)"
                  className={inp}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">No. HP</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx (opsional)"
                  type="tel"
                  className={inp}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Jenis Kelas</label>
                <select
                  value={classType}
                  onChange={e => setClassType(e.target.value)}
                  className={inp}
                >
                  <option value="">Komunitas umum (tanpa jenis kelas)</option>
                  {availableTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Pilih jenis kelas agar kontak muncul di absensi sesi kelas tersebut.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleClose}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
