'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SectionList } from '@/components/ui/SectionList'
import { Loader2 } from 'lucide-react'

const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

interface Props {
  classId:         string
  initialIsActive: boolean
}

export function ClassActiveToggle({ classId, initialIsActive }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const [value,  setValue ] = useState(initialIsActive ? 'active' : 'inactive')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved ] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('classes').update({ is_active: value === 'active' }).eq('id', classId)
    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SectionList
      label="Status Kelas"
      footer="Kelas nonaktif tidak muncul di landing page publik dan bot WA, tapi data lama (sesi, absensi, registrasi) tetap tersimpan. Beda dengan hapus kelas, ini bisa diaktifkan lagi kapan saja."
    >
      <div className="px-4 py-4 space-y-3">
        <select
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false) }}
          className={inp}
        >
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saved ? 'Status Tersimpan ✓' : saving ? 'Menyimpan...' : 'Simpan Status'}
        </button>
      </div>
    </SectionList>
  )
}
