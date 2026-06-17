'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2 } from 'lucide-react'

interface Props {
  table: 'events' | 'members' | 'classes' | 'broadcasts' | 'community_contacts'
  id: string
  redirectTo: string
  confirmText?: string
}

export function DeleteButton({ table, id, redirectTo, confirmText }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    setDeleting(true)
    await supabase.from(table).delete().eq('id', id)
    router.push(redirectTo)
    router.refresh()
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{confirmText ?? 'Yakin hapus?'}</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="h-8 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors"
        >
          {deleting ? 'Menghapus...' : 'Ya, hapus'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          disabled={deleting}
          className="h-8 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition-colors"
        >
          Batal
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="flex items-center gap-1.5 h-9 px-3 border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-xl text-sm transition-colors"
    >
      <Trash2 className="w-4 h-4" />
      Hapus
    </button>
  )
}
