'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Send, FileText, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const AUDIENCE_OPTIONS = [
  { value: 'all',      label: 'Semua Member'        },
  { value: 'active',   label: 'Member Aktif'         },
  { value: 'at_risk',  label: 'Member Perlu Perhatian' },
  { value: 'inactive', label: 'Member Tidak Aktif'   },
  { value: 'new',      label: 'Member Baru'          },
]

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export default function NewBroadcastPage() {
  const [title,    setTitle]    = useState('')
  const [audience, setAudience] = useState('all')
  const [content,  setContent]  = useState('')
  const [drafting, setDrafting] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const router  = useRouter()
  const supabase = createClient()

  async function draftWithAI() {
    setDrafting(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/draft-broadcast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ audience, title }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setContent(data.content)
    } catch (e: any) {
      setError(e.message ?? 'Gagal membuat draft.')
    } finally {
      setDrafting(false)
    }
  }

  async function saveBroadcast(asDraft: boolean) {
    if (!title.trim())   { setError('Judul tidak boleh kosong.'); return }
    if (!content.trim()) { setError('Isi pesan tidak boleh kosong.'); return }

    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get matching members for this audience
    let memberQuery = supabase
      .from('members')
      .select('id, name, phone')
      .eq('user_id', user.id)

    if (audience !== 'all') {
      memberQuery = memberQuery.eq('status', audience as any)
    }

    const { data: members } = await memberQuery
    const recipientCount = members?.length ?? 0

    // Insert broadcast
    const { data: bc, error: bcErr } = await supabase
      .from('broadcasts')
      .insert({
        user_id:          user.id,
        title:            title.trim(),
        content:          content.trim(),
        target_audience:  audience,
        status:           asDraft ? 'draft' : 'sent',
        recipient_count:  asDraft ? 0 : recipientCount,
        sent_at:          asDraft ? null : new Date().toISOString(),
      })
      .select('id')
      .single()

    if (bcErr || !bc) {
      setError(bcErr?.message ?? 'Gagal menyimpan.')
      setSaving(false)
      return
    }

    // If sending now, create recipient records
    if (!asDraft && members && members.length > 0) {
      await supabase.from('broadcast_recipients').insert(
        members.map(m => ({
          broadcast_id: bc.id,
          member_id:    m.id,
          phone:        m.phone,
          name:         m.name,
          status:       'pending',
        }))
      )
    }

    router.push('/broadcasts')
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/broadcasts" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Buat Broadcast</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Judul Pesan</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Pengumuman Jadwal Lebaran"
            autoFocus
            className={inp}
          />
        </div>

        {/* Audience */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Kirim Ke</label>
          <select value={audience} onChange={e => setAudience(e.target.value)} className={inp}>
            {AUDIENCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Isi Pesan WhatsApp</label>
            <button
              type="button"
              onClick={draftWithAI}
              disabled={drafting}
              className="flex items-center gap-1 h-7 px-3 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium transition-colors disabled:opacity-60"
            >
              {drafting
                ? <><Loader2 className="w-3 h-3 animate-spin" />Membuat draft...</>
                : <><Sparkles className="w-3 h-3" />Draft dengan AI</>
              }
            </button>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={8}
            placeholder="Tulis pesanmu di sini, atau klik ✨ Draft dengan AI untuk dibuat otomatis..."
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-gray-400">
            {content.length} karakter · Pesan ini akan dikirim via WhatsApp
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => saveBroadcast(true)}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Simpan Draft
          </button>
          <button
            onClick={() => saveBroadcast(false)}
            disabled={saving || !content.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
            Kirim Sekarang
          </button>
        </div>
      </div>
    </div>
  )
}
