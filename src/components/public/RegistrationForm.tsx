'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Upload, Loader2, Phone } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface Props {
  eventId: string
  userId: string
  instructorPhone: string | null
  earlyBirdAvailable: boolean
  earlyBirdPrice: number
  otsPrice: number
  eventTitle: string
  eventDescription: string | null
}

const inp = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function RegistrationForm({
  eventId,
  userId,
  instructorPhone,
  earlyBirdAvailable,
  earlyBirdPrice,
  otsPrice,
  eventTitle,
  eventDescription,
}: Props) {
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  // Tier is auto-determined by quota — no manual user choice
  const tier = earlyBirdAvailable ? 'early_bird' : 'ots'
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,     setError]   = useState<string | null>(null)
  const [success,   setSuccess] = useState(false)

  const supabase    = createClient()
  const amount      = tier === 'early_bird' ? earlyBirdPrice : otsPrice
  const waNumber    = instructorPhone?.replace(/\D/g, '').replace(/^0/, '62')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())   { setError('Nama tidak boleh kosong.'); return }
    if (!phone.trim())  { setError('Nomor HP tidak boleh kosong.'); return }
    if (!proofFile)     { setError('Bukti transfer wajib diupload sebelum mendaftar.'); return }

    setSubmitting(true)
    setError(null)

    let proofUrl: string | null = null

    // Upload bukti transfer ke Supabase Storage (jika ada file)
    if (proofFile) {
      const ext      = proofFile.name.split('.').pop()
      const filePath = `${eventId}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, proofFile, { cacheControl: '3600', upsert: false })

      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(uploadData.path)
        proofUrl = urlData?.publicUrl ?? null
      }
      // Upload gagal → lanjutkan tanpa proof (bisa kirim via WA)
    }

    // Simpan registrasi
    const { error: regErr } = await supabase
      .from('registrations')
      .insert({
        event_id:         eventId,
        user_id:          userId,
        registrant_name:  name.trim(),
        registrant_phone: phone.trim(),
        tier,
        amount_paid:      amount,
        payment_status:   'pending',
        proof_url:        proofUrl,
      })

    if (regErr) {
      setError('Gagal mendaftar. Coba lagi dalam beberapa saat.')
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Pendaftaran Berhasil! 🎉</h2>
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-semibold">{name}</span> berhasil terdaftar untuk
        </p>
        <p className="text-sm font-semibold text-violet-700 mb-4">{eventTitle}</p>
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-left mb-4">
          <p className="text-xs font-semibold text-yellow-700 mb-1">Langkah selanjutnya:</p>
          <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
            <li>Transfer pembayaran sebesar <strong>{formatRupiah(amount)}</strong></li>
            <li>Kirim bukti transfer ke instruktur</li>
            <li>Tunggu konfirmasi dari tim instruktur</li>
          </ol>
        </div>

        {eventDescription && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-left mb-4">
            <p className="text-xs font-semibold text-violet-700 mb-1.5">📋 Info penting dari instruktur:</p>
            <p className="text-xs text-violet-700 whitespace-pre-line leading-relaxed">{eventDescription}</p>
          </div>
        )}
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo, saya ${name} (${phone}) baru mendaftar untuk ${eventTitle}. Berikut bukti transfer saya.`)}`}
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

        {/* Name */}
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

        {/* Phone */}
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

        {/* Total — auto-priced, no manual tier choice */}
        <div className={`flex items-center justify-between p-3 rounded-xl ${tier === 'early_bird' ? 'bg-green-50 border border-green-100' : 'bg-violet-50 border border-violet-100'}`}>
          <div>
            <p className="text-xs font-medium text-gray-500">
              {tier === 'early_bird' ? 'Early Bird 🔥' : 'OTS'}
            </p>
            <p className="text-sm text-gray-600">Total pembayaran</p>
          </div>
          <span className={`text-xl font-bold ${tier === 'early_bird' ? 'text-green-700' : 'text-violet-700'}`}>
            {formatRupiah(amount)}
          </span>
        </div>

        {/* Proof upload */}
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
          <p className="text-xs text-gray-400">
            Format: JPG, PNG, atau gambar lainnya. Wajib diupload sebelum mendaftar.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Mendaftar...</>
          ) : (
            `Daftar Sekarang · ${formatRupiah(amount)}`
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Dengan mendaftar, kamu setuju mengikuti event ini.
        </p>
      </form>
    </div>
  )
}
