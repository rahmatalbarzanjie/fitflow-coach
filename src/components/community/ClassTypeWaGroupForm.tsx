'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, RefreshCw, ChevronDown, Info } from 'lucide-react'

interface Props {
  userId:          string
  type:            string
  label:           string
  initialLink:     string
  initialGroupId?: string
}

interface WaGroup {
  id:   string
  name: string
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

export function ClassTypeWaGroupForm({
  userId,
  type,
  label,
  initialLink,
  initialGroupId = '',
}: Props) {
  const supabase = createClient()

  const [link,       setLink      ] = useState(initialLink)
  const [groupId,    setGroupId   ] = useState(initialGroupId)
  const [groups,     setGroups    ] = useState<WaGroup[]>([])
  const [loadingGrp, setLoadingGrp] = useState(false)
  const [grpError,   setGrpError  ] = useState('')
  const [saving,     setSaving    ] = useState(false)
  const [saved,      setSaved     ] = useState(false)

  const selectedGroup = groups.find(g => g.id === groupId)

  async function fetchGroups() {
    setLoadingGrp(true)
    setGrpError('')
    try {
      const res  = await fetch('/api/wa/groups')
      const data = await res.json()
      if (!res.ok) {
        setGrpError(data.error ?? 'Gagal ambil daftar grup')
        return
      }
      setGroups(data.groups ?? [])
    } catch {
      setGrpError('Gagal terhubung ke Fonnte')
    } finally {
      setLoadingGrp(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])

  async function save() {
    setSaving(true)
    await supabase.from('class_type_benefits').upsert(
      {
        user_id:        userId,
        type,
        wa_invite_link: link.trim()    || null,
        wa_group_id:    groupId.trim() || null,
      },
      { onConflict: 'user_id,type' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-900">{label}</p>

      {/* STEP 1 — Pilih Grup WA */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-gray-600">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold mr-1">1</span>
            Pilih Grup WA Komunitas
          </p>
          <button
            onClick={fetchGroups}
            disabled={loadingGrp}
            className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loadingGrp ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {grpError ? (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
            <p className="text-xs text-red-500">{grpError}</p>
            <p className="text-xs text-red-400 mt-0.5">
              Pastikan token Fonnte sudah diset di Pengaturan → WhatsApp.
            </p>
          </div>
        ) : loadingGrp && groups.length === 0 ? (
          <div className="h-9 flex items-center gap-2 px-3 rounded-lg border border-gray-200 bg-gray-50">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
            <span className="text-xs text-gray-400">Memuat daftar grup...</span>
          </div>
        ) : (
          <div className="relative">
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className={`${inp} appearance-none pr-8 bg-white`}
            >
              <option value="">-- Pilih grup komunitas --</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        {selectedGroup && (
          <p className="text-xs text-green-600 mt-1">
            ✓ Peserta yang chat di grup ini otomatis masuk komunitas {label}.
          </p>
        )}
        {groupId && !selectedGroup && !loadingGrp && (
          <p className="text-xs text-gray-400 mt-1 font-mono">{groupId}</p>
        )}
      </div>

      {/* STEP 2 — Link Invite (manual dari WA) */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold mr-1">2</span>
          Link Invite Grup WA
        </p>
        <input
          type="text"
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          className={inp}
        />
        <div className="flex items-start gap-1.5 mt-1.5">
          <Info className="w-3 h-3 text-gray-300 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">
            Buka grup WA → Info Grup → Invite via Link → Salin link.
            Ditampilkan di landing page agar peserta bisa join komunitas.
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
         : saved  ? <Check   className="w-3.5 h-3.5" />
         : null}
        {saved ? 'Tersimpan' : 'Simpan'}
      </button>
    </div>
  )
}
