'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  type: string
  label: string
  initialLink: string
}

export function ClassTypeWaGroupForm({ userId, type, label, initialLink }: Props) {
  const supabase = createClient()
  const [link,   setLink]   = useState(initialLink)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('class_type_benefits').upsert(
      { user_id: userId, type, wa_invite_link: link.trim() || null },
      { onConflict: 'user_id,type' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 h-9 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? 'Tersimpan' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
