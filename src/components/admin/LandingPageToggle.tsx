'use client'

import { useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'

export function LandingPageToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving,  setSaving]  = useState(false)

  async function toggle() {
    const next = !enabled
    setSaving(true)
    const res = await fetch('/api/admin/config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key: 'home_page_enabled', value: next ? 'true' : 'false' }),
    })
    setSaving(false)
    if (res.ok) setEnabled(next)
  }

  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-gray-100 bg-white mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${enabled ? 'bg-green-50' : 'bg-gray-100'}`}>
          <Globe className={`w-4.5 h-4.5 ${enabled ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Landing Page (/home)</p>
          <p className="text-xs text-gray-400">
            {enabled ? 'Aktif — calon klien bisa lihat halaman jual & harga' : 'Nonaktif — pengunjung lihat halaman "sedang dikembangkan"'}
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
        aria-label="Toggle landing page"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        ) : (
          <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        )}
      </button>
    </div>
  )
}
