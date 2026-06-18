'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Upload, Loader2, Phone, Banknote, Landmark } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface Props {
  classId: string
  userId: string
  instructorPhone: string | null
  targetDate: string
  className: string
  classPrice: number
}

const inp = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function ClassRegistrationForm({
  classId,
  userId,
  instructorPhone,
  targetDate,
  className,
  classPrice,
}: Props) {
  const isFree = classPrice <= 0

  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [method,     setMethod]     = useState<'cash' | 'transfer'>('cash')
  const [proofFile,  setProofFile]  = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)

  const supabase = createClient()
  const waNumber  = instructorPhone?.replace(/\D/g, '').replace(/^0/, '62')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())  { setError('Nama tidak boleh kosong.'); return }
    if (!phone.trim()) { setError('Nomor HP tidak boleh kosong.'); return }
    if (!isFree && method === 'transfer' && !proofFile) {
      setError('Bukti transfer wajib diupload sebelum mendaftar.')
      return
    }

    setSubmitting(true)
    setError(null)

    let proofUrl: string | null = null

    if (!isFree && method === 'transfer' && proofFile) {
      const ext      = proofFile.name.split('.').pop()
      const filePath = `class-${classId}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, proofFile, { cacheControl: '3600', upsert: false })

      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(uploadData.path)
        proofUrl = urlData?.publicUrl ?? null
      }
    }

    const paymentMethod = isFree ? null : method
    const paymentStatus = isFree || method === 'cash' ? 'confirmed' : 'pending'

    // ID di-generate di client supaya tidak perlu .select() setelah insert —
    // peserta publik (anon) cuma punya izin INSERT, bukan SELECT, jadi
    // .select().single() setelah insert akan gagal kena RLS.
    const registrationId = crypto.randomUUID()

    const { error: regErr } = await supabase
      .from('registrations')
      .insert({
        id:                registrationId,
        class_id:         classId,
        session_date:     targetDate,
        user_id:          userId,
        registrant_name:  name.trim(),
        registrant_phone: phone.trim(),
        tier:             'ots',
        amount_paid:      isFree ? 0 : classPrice,
        payment_method:   paymentMethod,
        payment_status:   paymentStatus,
        proof_url:        proofUrl,
      })

    if (regErr) {
      setError('Gagal mendaftar. Coba lagi dalam beberapa saat.')
      setSubmitting(false)
      return
    }

    fetch('/api/notifications/class-registration', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ registrationId }),
    }).catch(() => {
      // notifikasi WA gagal tidak perlu blokir UI
    })

    setSuccess(true)
    setSubmitting(false)
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    const needsTransferInstructions = !isFree && method === 'transfer'
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Pendaftaran Berhasil! 🎉</h2>
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-semibold">{name}</span> berhasil terdaftar untuk
        </p>
        <p className="text-sm font-semibold text-violet-700 mb-4">{className}</p>

        {needsTransferInstructions ? (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-left mb-4">
            <p className="text-xs font-semibold text-yellow-700 mb-1">Langkah selanjutnya:</p>
            <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
              <li>Transfer pembayaran sebesar <strong>{formatRupiah(classPrice)}</strong></li>
              <li>Kirim bukti transfer ke instruktur</li>
              <li>Tunggu konfirmasi dari instruktur</li>
            </ol>
          </div>
        ) : !isFree ? (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left mb-4">
            <p className="text-xs text-green-700">
              Bayar <strong>{formatRupiah(classPrice)}</strong> langsung di tempat saat hadir ya. Sampai jumpa di kelas! 💪
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left mb-4">
            <p className="text-xs text-green-700">Sampai jumpa di kelas! 💪</p>
          </div>
        )}

        {needsTransferInstructions && waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo, saya ${name} (${phone}) baru mendaftar untuk ${className}. Berikut bukti transfer saya.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-11 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Phone className="w-4 h-4" />
            Kirim Bukti Transfer via WhatsApp
          </a>
        )}
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-base font-bold text-gray-900">Form Pendaftaran</h2>
        <p className="text-xs text-gray-400 mt-0.5">Isi data diri kamu untuk mendaftar</p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nama sesuai identitas"
            required
            autoFocus
            className={inp}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Nomor WhatsApp <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            required
            className={inp}
          />
          <p className="text-xs text-gray-400">Untuk konfirmasi pendaftaran</p>
        </div>

        {!isFree && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('cash')}
                className={`flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-medium border transition-colors ${
                  method === 'cash'
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                }`}
              >
                <Banknote className="w-4 h-4" />
                OTS (di tempat)
              </button>
              <button
                type="button"
                onClick={() => setMethod('transfer')}
                className={`flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-medium border transition-colors ${
                  method === 'transfer'
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                }`}
              >
                <Landmark className="w-4 h-4" />
                Transfer
              </button>
            </div>
          </div>
        )}

        {!isFree && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50 border border-violet-100">
            <p className="text-sm text-gray-600">Total pembayaran</p>
            <span className="text-xl font-bold text-violet-700">{formatRupiah(classPrice)}</span>
          </div>
        )}

        {!isFree && method === 'transfer' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Bukti Transfer <span className="text-red-500">*</span>
            </label>
            <label className={`flex items-center gap-3 cursor-pointer ${inp} py-2.5 justify-center border-dashed ${proofFile ? 'border-violet-400 bg-violet-50' : 'border-gray-300 hover:border-violet-300'}`}>
              <Upload className={`w-4 h-4 shrink-0 ${proofFile ? 'text-violet-500' : 'text-gray-400'}`} />
              <span className={`text-sm truncate ${proofFile ? 'text-violet-700 font-medium' : 'text-gray-500'}`}>
                {proofFile ? proofFile.name : 'Upload foto / screenshot bukti transfer'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { setProofFile(e.target.files?.[0] ?? null); setError(null) }}
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Mendaftar...</>
          ) : isFree ? (
            'Daftar Sekarang'
          ) : (
            `Daftar Sekarang · ${formatRupiah(classPrice)}`
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Dengan mendaftar, kamu setuju mengikuti kelas ini.
        </p>
      </form>
    </div>
  )
}
