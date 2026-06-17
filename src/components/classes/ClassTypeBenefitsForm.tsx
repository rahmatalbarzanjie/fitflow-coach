'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  type: string
  label: string
  initialBenefits: string
}

export function ClassTypeBenefitsForm({ userId, type, label, initialBenefits }: Props) {
  const supabase = createClient()
  const [benefits, setBenefits] = useState(initialBenefits)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('class_type_benefits').upsert(
      { user_id: userId, type, benefits: benefits.trim() || null },
      { onConflict: 'user_id,type' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
      <textarea
        value={benefits}
        onChange={e => setBenefits(e.target.value)}
        rows={2}
        placeholder={`Contoh: ${label} bagus untuk membakar kalori dan meningkatkan stamina...`}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2"
      />
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 h-8 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saved ? 'Tersimpan' : 'Simpan'}
      </button>
    </div>
  )
}
