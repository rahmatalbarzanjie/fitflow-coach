'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload } from 'lucide-react'

interface Method {
  id: string
  method_type: string
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  qris_image_url: string | null
  sort_order: number
}

interface Props {
  profileId: string
  userId: string
  nextSortOrder: number
  onAdded: (method: Method) => void
}

const inputClass = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function AddPaymentMethodForm({ profileId, userId, nextSortOrder, onAdded }: Props) {
  const supabase = createClient()
  const [methodType, setMethodType] = useState<'bank' | 'qris'>('bank')
  const [bankName, setBankName]     = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName]     = useState('')
  const [qrisFile, setQrisFile]     = useState<File | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function submit() {
    setError(null)

    if (methodType === 'bank' && (!bankName.trim() || !accountNumber.trim())) {
      setError('Nama bank dan nomor rekening wajib diisi')
      return
    }
    if (methodType === 'qris' && !qrisFile) {
      setError('Upload gambar QRIS dulu')
      return
    }

    setSaving(true)

    let qrisImageUrl: string | null = null
    if (methodType === 'qris' && qrisFile) {
      const ext  = qrisFile.name.split('.').pop()
      const path = `${profileId}/${Date.now()}.${ext}`
      const { data, error: upErr } = await supabase.storage
        .from('payment-qris')
        .upload(path, qrisFile, { cacheControl: '3600', upsert: true })
      if (upErr || !data) { setError(upErr?.message ?? 'Upload QRIS gagal'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('payment-qris').getPublicUrl(data.path)
      qrisImageUrl = urlData?.publicUrl ?? null
    }

    const { data: row, error: insertErr } = await supabase
      .from('payment_methods')
      .insert({
        user_id: userId,
        payment_profile_id: profileId,
        method_type: methodType,
        bank_name: methodType === 'bank' ? bankName.trim() : null,
        account_number: methodType === 'bank' ? accountNumber.trim() : null,
        account_name: methodType === 'bank' ? (accountName.trim() || null) : null,
        qris_image_url: qrisImageUrl,
        sort_order: nextSortOrder,
      })
      .select('id, method_type, bank_name, account_number, account_name, qris_image_url, sort_order')
      .single()

    if (insertErr || !row) { setError(insertErr?.message ?? 'Gagal simpan'); setSaving(false); return }

    onAdded(row as Method)
    setBankName(''); setAccountNumber(''); setAccountName(''); setQrisFile(null)
    setSaving(false)
  }

  return (
    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMethodType('bank')}
          className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${methodType === 'bank' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Bank
        </button>
        <button
          type="button"
          onClick={() => setMethodType('qris')}
          className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${methodType === 'qris' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          QRIS
        </button>
      </div>

      {methodType === 'bank' ? (
        <div className="space-y-2">
          <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Nama Bank (mis. BCA)" className={inputClass} />
          <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Nomor Rekening" className={inputClass} />
          <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Atas Nama (opsional)" className={inputClass} />
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer h-24 rounded-lg border-2 border-dashed border-gray-200 hover:border-violet-400 bg-white transition-all">
          <Upload className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">{qrisFile ? qrisFile.name : 'Upload gambar QRIS'}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setQrisFile(f) }}
          />
        </label>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="w-full h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {saving ? 'Menyimpan...' : 'Tambah Metode'}
      </button>
    </div>
  )
}
