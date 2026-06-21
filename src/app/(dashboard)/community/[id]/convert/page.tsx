'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { Loader2, UserPlus } from 'lucide-react'

const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export default function CommunityConvertPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const supabase = createClient()

  const [name,    setName   ] = useState('')
  const [phone,   setPhone  ] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving ] = useState(false)
  const [error,   setError  ] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('community_contacts')
        .select('name, phone, converted_member_id')
        .eq('id', id)
        .single()
      if (data?.converted_member_id) {
        // Sudah jadi member, redirect balik
        router.replace(`/community/${id}`)
        return
      }
      if (data) {
        setName(data.name ?? '')
        setPhone(data.phone ?? '')
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleConvert() {
    if (!name.trim() || !phone.trim()) {
      setError('Nama dan nomor HP wajib diisi untuk menjadi member')
      return
    }
    setSaving(true)
    setError('')

    const res = await fetch(`/api/community/${id}/convert`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, phone }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Gagal mengonversi')
      return
    }

    // Redirect ke profil member baru
    if (data.memberId) {
      router.push(`/members/${data.memberId}`)
    } else {
      router.push('/members')
    }
    router.refresh()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
    </div>
  )

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref={`/community/${id}`}
        title="Jadikan Member"
        subtitle="Konfirmasi data sebelum mendaftar"
      />

      <SectionList label="Tentang Konversi">
        <div className="px-4 py-3.5">
          <p className="text-xs text-gray-500 leading-relaxed">
            Kontak ini akan didaftarkan sebagai member berbayar. Data nama dan HP akan disalin ke daftar member. Kontak komunitas tetap ada dan ditandai sudah menjadi member.
          </p>
        </div>
      </SectionList>

      <SectionList label="Data Member Baru">
        <div className="px-4 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama member"
              className={inp}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Nomor HP <span className="text-red-500">*</span>
            </label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              type="tel"
              className={inp}
            />
            <p className="text-xs text-gray-400">Dipakai untuk broadcast WhatsApp</p>
          </div>

          <button
            onClick={handleConvert}
            disabled={saving}
            className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Mendaftarkan...</>
              : <><UserPlus className="w-4 h-4" /> Daftarkan sebagai Member</>
            }
          </button>
        </div>
      </SectionList>
    </div>
  )
}
