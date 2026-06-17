'use client'

import { useState } from 'react'
import { Star, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  memberId: string
  memberName: string
}

export function TestimonialSubmitForm({ memberId, memberName }: Props) {
  const [rating,  setRating]  = useState(5)
  const [hovered, setHovered] = useState(0)
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  async function submit() {
    if (!content.trim()) { setError('Isi testimoni tidak boleh kosong'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/testimonials/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memberId, rating, content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Gagal mengirim'); setSaving(false); return }
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-900 mb-1">Terima kasih, {memberName}!</p>
        <p className="text-sm text-gray-500">Testimoni kamu sudah terkirim dan akan tayang setelah ditinjau.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Nama</p>
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{memberName}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="p-0.5"
            >
              <Star
                className={`w-8 h-8 ${
                  n <= (hovered || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Testimoni</p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          placeholder="Ceritakan pengalamanmu ikut kelas..."
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Kirim Testimoni
      </button>
    </div>
  )
}
