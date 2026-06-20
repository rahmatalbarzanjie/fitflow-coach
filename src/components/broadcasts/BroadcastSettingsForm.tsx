'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react'

const AUDIENCE_OPTIONS = [
  { value: 'all',      label: 'Semua Member'           },
  { value: 'active',   label: 'Member Aktif'           },
  { value: 'at_risk',  label: 'Member Perlu Follow Up' },
  { value: 'inactive', label: 'Member Tidak Aktif'     },
  { value: 'new',      label: 'Member Baru'            },
]

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-gray-50 disabled:text-gray-400'

interface Broadcast {
  id:              string
  title:           string
  content:         string
  target_audience: string
  target_class_id: string | null
}

interface GroupClass {
  id: string
  name: string
  wa_group_name: string | null
}

interface Props {
  broadcast:    Broadcast
  groupClasses: GroupClass[]
  locked:       boolean
}

export function BroadcastSettingsForm({ broadcast, groupClasses, locked }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const [title,    setTitle]    = useState(broadcast.title)
  const [audience, setAudience] = useState(broadcast.target_audience)
  const [content,  setContent]  = useState(broadcast.content)
  const [alsoSendGroup, setAlsoSendGroup] = useState(!!broadcast.target_class_id)
  const [targetClassId, setTargetClassId] = useState(broadcast.target_class_id ?? '')

  const [drafting, setDrafting] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function draftWithAI() {
    setDrafting(true)
    setError(null)
    try {
      const res  = await fetch('/api/ai/draft-broadcast', {
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

  async function save() {
    if (!title.trim())   { setError('Judul tidak boleh kosong.'); return }
    if (!content.trim()) { setError('Isi pesan tidak boleh kosong.'); return }

    // Guard cepat di client - pengecekan sesungguhnya ada di trigger Postgres
    // (prevent_broadcast_edit_after_sent), supaya tetap aman walau locked
    // di sini basi/di-bypass.
    if (locked) {
      setError('Broadcast ini sudah ada penerima yang berhasil terkirim - tidak bisa diubah lagi.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: updErr } = await supabase
      .from('broadcasts')
      .update({
        title:           title.trim(),
        content:         content.trim(),
        target_audience: audience,
        target_class_id: alsoSendGroup && targetClassId ? targetClassId : null,
      })
      .eq('id', broadcast.id)

    setSaving(false)
    if (updErr) { setError(updErr.message); return }

    router.push(`/broadcasts/${broadcast.id}`)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      {locked && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-orange-50 border border-orange-100">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700 leading-relaxed">
            Broadcast ini sudah ada yang terkirim. Judul/isi/audience dikunci
            supaya member yang sudah dapat pesan dan yang belum tidak menerima
            versi yang berbeda. Hapus dan buat baru kalau perlu konten yang
            benar-benar lain.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Judul Pesan</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={locked}
          className={inp}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Kirim Ke Member</label>
        <select value={audience} onChange={e => setAudience(e.target.value)} disabled={locked} className={inp}>
          {AUDIENCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {groupClasses.length > 0 && (
        <div className="space-y-1.5 p-3 bg-violet-50/50 border border-violet-100 rounded-xl">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={alsoSendGroup}
              onChange={e => setAlsoSendGroup(e.target.checked)}
              disabled={locked}
              className="accent-violet-600"
            />
            Juga kirim ke grup komunitas
          </label>
          {alsoSendGroup && (
            <select value={targetClassId} onChange={e => setTargetClassId(e.target.value)} disabled={locked} className={inp}>
              <option value="">Pilih kelas / grup...</option>
              {groupClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.wa_group_name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Isi Pesan WhatsApp</label>
          <button
            type="button"
            onClick={draftWithAI}
            disabled={drafting || locked}
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
          disabled={locked}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <p className="text-xs text-gray-400">{content.length} karakter</p>
      </div>

      {!locked && (
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Simpan
        </button>
      )}
    </div>
  )
}
