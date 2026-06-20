'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, FileText, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'

const AUDIENCE_OPTIONS = [
  { value: 'all',      label: 'Semua Member'        },
  { value: 'active',   label: 'Member Aktif'         },
  { value: 'at_risk',  label: 'Member Perlu Follow Up' },
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

  const [groupClasses,    setGroupClasses]    = useState<{ id: string; name: string; wa_group_name: string | null }[]>([])
  const [alsoSendGroup,   setAlsoSendGroup]   = useState(false)
  const [targetClassId,   setTargetClassId]   = useState('')

  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('classes')
        .select('id, name, wa_group_id, wa_group_name')
        .eq('user_id', user.id)
        .not('wa_group_id', 'is', null)
      setGroupClasses(
        ((data ?? []) as any[]).map(c => ({ id: c.id, name: c.name, wa_group_name: c.wa_group_name }))
      )
    })
  }, [])

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

  async function saveBroadcast() {
    if (!title.trim())   { setError('Judul tidak boleh kosong.'); return }
    if (!content.trim()) { setError('Isi pesan tidak boleh kosong.'); return }

    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Selalu simpan sebagai draft - kirim adalah aksi terpisah dari Broadcast
    // Hub (/broadcasts/[id]), bukan dari sini, supaya alur kirim/retry yang
    // idempotent konsisten satu tempat.
    const { data: bc, error: bcErr } = await supabase
      .from('broadcasts')
      .insert({
        user_id:         user.id,
        title:           title.trim(),
        content:         content.trim(),
        target_audience: audience,
        target_class_id: alsoSendGroup && targetClassId ? targetClassId : null,
        status:          'draft',
        recipient_count: 0,
      })
      .select('id')
      .single()

    if (bcErr || !bc) {
      setError(bcErr?.message ?? 'Gagal menyimpan.')
      setSaving(false)
      return
    }

    router.push(`/broadcasts/${bc.id}`)
    router.refresh()
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/broadcasts" title="Buat Broadcast" />

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
          <label className="block text-sm font-medium text-gray-700">Kirim Ke Member</label>
          <select value={audience} onChange={e => setAudience(e.target.value)} className={inp}>
            {AUDIENCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Komunitas group */}
        {groupClasses.length > 0 && (
          <div className="space-y-1.5 p-3 bg-violet-50/50 border border-violet-100 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={alsoSendGroup}
                onChange={e => setAlsoSendGroup(e.target.checked)}
                className="accent-violet-600"
              />
              Juga kirim ke grup komunitas
            </label>
            {alsoSendGroup && (
              <select value={targetClassId} onChange={e => setTargetClassId(e.target.value)} className={inp}>
                <option value="">Pilih kelas / grup...</option>
                {groupClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.wa_group_name}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-violet-500">
              Pesan akan diposting sekali ke grup WA, terpisah dari kiriman personal ke Member.
            </p>
          </div>
        )}

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

        {/* Simpan dulu sebagai draft - kirim dilakukan dari Broadcast Hub
            supaya alur kirim/retry konsisten satu tempat (idempotent). */}
        <div className="pt-1">
          <button
            onClick={saveBroadcast}
            disabled={saving || !content.trim()}
            className="w-full flex items-center justify-center gap-1.5 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileText className="w-4 h-4" />
            }
            Simpan & Lanjutkan
          </button>
        </div>
      </div>
    </div>
  )
}
