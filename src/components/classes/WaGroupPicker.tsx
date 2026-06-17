'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users2, Loader2, AlertCircle, X } from 'lucide-react'

interface Props {
  classId: string
  currentGroupId: string | null
  currentGroupName: string | null
}

export function WaGroupPicker({ classId, currentGroupId, currentGroupName }: Props) {
  const router = useRouter()
  const [picking,  setPicking ] = useState(false)
  const [loading,  setLoading ] = useState(false)
  const [groups,   setGroups  ] = useState<{ id: string; name: string }[] | null>(null)
  const [error,    setError   ] = useState('')
  const [saving,   setSaving  ] = useState(false)

  async function openPicker() {
    setPicking(true)
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wa/groups')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal ambil daftar grup')
      } else {
        setGroups(data.groups ?? [])
      }
    } catch {
      setError('Koneksi gagal')
    } finally {
      setLoading(false)
    }
  }

  async function selectGroup(g: { id: string; name: string } | null) {
    setSaving(true)
    try {
      await fetch(`/api/classes/${classId}/wa-group`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ groupId: g?.id ?? null, groupName: g?.name ?? null }),
      })
      setPicking(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Users2 className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">Grup Komunitas WA</p>
            <p className="text-xs text-gray-500 truncate">
              {currentGroupName ?? 'Belum terhubung ke grup'}
            </p>
          </div>
        </div>
        <button
          onClick={openPicker}
          className="h-8 px-3 shrink-0 text-xs font-medium border border-gray-200 hover:bg-white rounded-lg text-gray-600 transition-colors"
        >
          {currentGroupId ? 'Ganti' : 'Pilih Grup'}
        </button>
      </div>

      {picking && (
        <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">Pilih grup WA</p>
            <button onClick={() => setPicking(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengambil daftar grup...
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1 text-xs text-red-500 py-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          {groups !== null && !loading && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {groups.length === 0 && (
                <p className="text-xs text-gray-400 py-2">Tidak ada grup ditemukan dari nomor bot.</p>
              )}
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => selectGroup(g)}
                  disabled={saving}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-lg hover:bg-violet-50 text-gray-700 disabled:opacity-50 transition-colors"
                >
                  {g.name}
                </button>
              ))}
              {currentGroupId && (
                <button
                  onClick={() => selectGroup(null)}
                  disabled={saving}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50 transition-colors"
                >
                  Putuskan koneksi grup
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
