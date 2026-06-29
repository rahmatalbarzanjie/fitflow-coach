'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { CLASS_TYPES } from '@/lib/constants'
import { Loader2, Trash2 } from 'lucide-react'

const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export default function CommunityContactSettingsPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const supabase = createClient()

  const [name,       setName      ] = useState('')
  const [phone,      setPhone     ] = useState('')
  const [classType,  setClassType ] = useState('')
  const [loading,    setLoading   ] = useState(true)
  const [saving,     setSaving    ] = useState(false)
  const [deleting,   setDeleting  ] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error,      setError     ] = useState('')
  const [saved,      setSaved     ] = useState(false)
  const [contactName, setContactName] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('community_contacts')
        .select('name, phone, class_type')
        .eq('id', id)
        .single()
      if (data) {
        setName(data.name ?? '')
        setPhone(data.phone ?? '')
        setClassType(data.class_type ?? '')
        setContactName(data.name ?? '(tanpa nama)')
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    if (!name.trim() && !phone.trim()) {
      setError('Isi minimal nama atau nomor HP')
      return
    }
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('community_contacts')
      .update({ name: name || null, phone: phone || null, class_type: classType || null })
      .eq('id', id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => {
      router.push(`/community/${id}`)
      router.refresh()
    }, 800)
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('community_contacts').delete().eq('id', id)
    router.push('/community')
    router.refresh()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
    </div>
  )

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader
        backHref={`/community/${id}`}
        title="Pengaturan Kontak"
        subtitle={contactName}
      />

      {/* Form edit */}
      <SectionList label="Informasi Kontak">
        <div className="px-4 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Nama</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama peserta" className={inp} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Nomor HP</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" className={inp} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Jenis Kelas</label>
            <select value={classType} onChange={e => setClassType(e.target.value)} className={inp}>
              <option value="">Komunitas umum</option>
              {CLASS_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved ? 'Tersimpan ✓' : saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </SectionList>

      {/* Zona berbahaya */}
      <SectionList label="Zona Berbahaya">
        <div className="px-4 py-5">
          <p className="text-xs text-gray-400 mb-4">
            Menghapus kontak ini akan menghapus data secara permanen dan tidak bisa dikembalikan.
          </p>

          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="flex items-center gap-2 h-10 px-4 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Hapus Kontak
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-600">Yakin ingin menghapus kontak ini?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDel(false)}
                  className="flex-1 h-10 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionList>
    </div>
  )
}
