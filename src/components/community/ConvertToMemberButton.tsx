'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, X } from 'lucide-react'

interface Props {
  contactId: string
  initialName: string
  initialPhone: string
}

const inp = 'w-full h-8 px-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function ConvertToMemberButton({ contactId, initialName, initialPhone }: Props) {
  const router = useRouter()
  const [open,   setOpen  ] = useState(false)
  const [name,   setName  ] = useState(initialName)
  const [phone,  setPhone ] = useState(initialPhone)
  const [saving, setSaving] = useState(false)
  const [error,  setError ] = useState('')

  async function submit() {
    if (!name.trim() || !phone.trim()) {
      setError('Nama dan HP wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/community/${contactId}/convert`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, phone }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Gagal konversi')
      return
    }
    setOpen(false)
    router.refresh()
  }

  if (open) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama" className={`${inp} w-24`} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="No. HP" className={`${inp} w-28`} />
          <button onClick={submit} disabled={saving} className="h-8 px-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ya'}
          </button>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg transition-colors"
    >
      <UserPlus className="w-3 h-3" />
      Jadikan Member
    </button>
  )
}
