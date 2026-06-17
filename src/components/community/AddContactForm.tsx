'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'

interface ClassOption {
  id: string
  name: string
}

interface Props {
  classes: ClassOption[]
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function AddContactForm({ classes }: Props) {
  const router = useRouter()
  const [open,    setOpen   ] = useState(false)
  const [name,    setName   ] = useState('')
  const [phone,   setPhone  ] = useState('')
  const [classId, setClassId] = useState('')
  const [saving,  setSaving ] = useState(false)
  const [error,   setError  ] = useState('')

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
      body:    JSON.stringify({ name, phone, classId: classId || null }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Gagal menyimpan')
      return
    }
    setName(''); setPhone(''); setClassId(''); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Tambah Kontak
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Tambah Kontak Komunitas</p>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama (opsional)" className={inp} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="No. HP (opsional)" className={inp} />
      </div>
      <select value={classId} onChange={e => setClassId(e.target.value)} className={`${inp} mb-3`}>
        <option value="">Tanpa kelas spesifik</option>
        {classes.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        onClick={submit}
        disabled={saving}
        className="h-9 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        Simpan
      </button>
    </div>
  )
}
