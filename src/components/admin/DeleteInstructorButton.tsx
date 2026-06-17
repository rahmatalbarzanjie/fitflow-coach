'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  profileId: string
  confirmName: string
}

export function DeleteInstructorButton({ profileId, confirmName }: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [typed,   setTyped]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const canDelete = typed.trim() === confirmName.trim()

  async function handleDelete() {
    if (!canDelete) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/delete-instructor', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profileId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Gagal menghapus akun')
      setLoading(false)
      return
    }
    router.push('/admin')
    router.refresh()
  }

  if (!open) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <p className="text-sm font-semibold text-red-700">Zona Berbahaya</p>
        </div>
        <p className="text-xs text-red-500 mb-3">
          Hapus akun instruktur ini secara permanen, beserta SEMUA datanya (kelas, member, sesi, broadcast, dll). Tidak bisa dibatalkan.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 h-8 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus Instruktur Ini
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <p className="text-sm font-semibold text-red-700">Konfirmasi Penghapusan Permanen</p>
      </div>
      <p className="text-xs text-red-600 mb-3">
        Ketik <strong>{confirmName}</strong> untuk konfirmasi. Akun login, profil, kelas, member, sesi, dan broadcast milik instruktur ini akan terhapus permanen.
      </p>
      <input
        value={typed}
        onChange={e => setTyped(e.target.value)}
        placeholder={confirmName}
        className="w-full h-9 px-3 mb-3 rounded-lg border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
      />
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setTyped(''); setError('') }}
          disabled={loading}
          className="h-8 px-3 text-xs text-gray-500 border border-gray-200 hover:bg-white rounded-lg transition-colors"
        >
          Batal
        </button>
        <button
          onClick={handleDelete}
          disabled={!canDelete || loading}
          className="flex items-center gap-1.5 h-8 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Hapus Permanen
        </button>
      </div>
    </div>
  )
}
