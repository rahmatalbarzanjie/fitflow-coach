'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, ShieldCheck } from 'lucide-react'

interface Props {
  inviteId: string
}

export function FeedbackSubmitForm({ inviteId }: Props) {
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  async function submit() {
    if (!content.trim()) { setError('Isi feedback tidak boleh kosong'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/feedback/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ inviteId, content: content.trim() }),
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
        <p className="font-semibold text-gray-900 mb-1">Terima kasih!</p>
        <p className="text-sm text-gray-500">Feedback kamu sudah terkirim secara anonim.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">Identitas kamu tidak disimpan — feedback ini sepenuhnya anonim.</p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Kritik & Saran</p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={5}
          placeholder="Apa yang bisa diperbaiki dari kelas ini?"
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
        Kirim Feedback
      </button>
    </div>
  )
}
