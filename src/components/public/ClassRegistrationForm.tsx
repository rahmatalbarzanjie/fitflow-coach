'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { invalidateDashboardCache } from '@/lib/invalidate-dashboard'
import { CheckCircle, Upload, Loader2, Phone, Banknote, Landmark, ArrowLeft } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { PaymentMethodsDisplay } from './PaymentMethodsDisplay'

interface PaymentMethod {
  id: string
  method_type: string
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  qris_image_url: string | null
}

interface Props {
  slug: string
  classId: string
  instructorPhone: string | null
  targetDate: string
  className: string
  classPrice: number
  paymentMethods?: PaymentMethod[]
  paymentMethodsEnabled?: string | null
}

const inp = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function ClassRegistrationForm({
  slug,
  classId,
  instructorPhone,
  targetDate,
  className,
  classPrice,
  paymentMethods = [],
  paymentMethodsEnabled = 'both',
}: Props) {
  const isFree = classPrice <= 0
  // Kalau OTS/Transfer dimatikan instruktur, peserta tidak punya pilihan -
  // metode-nya dipaksa, toggle tidak ditampilkan sama sekali (lihat
  // showToggle di bawah).
  const showToggle = paymentMethodsEnabled === 'both' || !paymentMethodsEnabled

  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [method,     setMethod]     = useState<'cash' | 'transfer'>(
    paymentMethodsEnabled === 'transfer_only' ? 'transfer' : 'cash'
  )
  const [proofFile,  setProofFile]  = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)
  const [proofFailed, setProofFailed] = useState(false)
  // null = belum dicek / nomor belum cukup digit. Cuma dipakai untuk
  // menentukan tampilan form (skip bagian bayar) - server selalu
  // menghitung ulang sendiri saat submit, tidak pernah percaya nilai ini.
  const [membershipEligible, setMembershipEligible] = useState<boolean | null>(null)
  const [usedMembership, setUsedMembership] = useState(false)

  const supabase = createClient()
  const waNumber  = instructorPhone?.replace(/\D/g, '').replace(/^0/, '62')
  const skipPayment = !isFree && membershipEligible === true

  useEffect(() => {
    if (isFree) return
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 9) { setMembershipEligible(null); return }

    const timer = setTimeout(async () => {
      const client = createClient()
      const { data } = await client.rpc('check_membership_eligibility', {
        p_class_id:         classId,
        p_session_date:     targetDate,
        p_registrant_phone: phone.trim(),
      })
      setMembershipEligible(data === true)
    }, 500)

    return () => clearTimeout(timer)
  }, [phone, isFree, classId, targetDate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())  { setError('Nama tidak boleh kosong.'); return }
    if (!phone.trim()) { setError('Nomor HP tidak boleh kosong.'); return }
    if (!skipPayment && !isFree && method === 'transfer' && !proofFile) {
      setError('Bukti transfer wajib diupload sebelum mendaftar.')
      return
    }

    setSubmitting(true)
    setError(null)

    let proofUrl: string | null = null
    let uploadFailed = false

    if (!skipPayment && !isFree && method === 'transfer' && proofFile) {
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
      } else {
        // Upload gagal - lanjutkan pendaftaran (jangan blokir), tapi success
        // screen nanti perlu tahu ini supaya tidak salah klaim "bukti sudah
        // diterima" dan tetap menawarkan kirim manual via WA.
        uploadFailed = true
      }
    }
    setProofFailed(uploadFailed)

    const paymentMethod = isFree || skipPayment ? null : method

    // RPC adalah satu-satunya sumber kebenaran untuk kapasitas, duplikat,
    // harga, DAN status membership - server me-lock baris kelas,
    // re-validasi kuota, mencocokkan nomor HP ke member, dan menghitung
    // amount_paid sendiri (bukan dari nilai client). Browser tidak lagi
    // menentukan apa pun selain identitas pendaftar - `skipPayment` di
    // atas cuma untuk tampilan, server tetap menghitung ulang sendiri.
    const { data: regRows, error: regErr } = await supabase.rpc('create_class_registration', {
      p_class_id:         classId,
      p_session_date:     targetDate,
      p_registrant_name:  name.trim(),
      p_registrant_phone: phone.trim(),
      p_payment_method:   paymentMethod ?? undefined,
      p_proof_url:        proofUrl ?? undefined,
    })
    const registrationRow = regRows?.[0]
    const registrationId  = registrationRow?.id

    if (regErr) {
      setError(
        regErr.message === 'class_full'
          ? 'Maaf, kuota kelas ini sudah penuh.'
          : regErr.message === 'payment_method_not_allowed'
            ? 'Metode pembayaran ini tidak tersedia untuk kelas ini. Muat ulang halaman.'
            : 'Gagal mendaftar. Coba lagi dalam beberapa saat.'
      )
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

    // Sama seperti registrasi event - peserta belum login, kirim classId
    // supaya cache Beranda instruktur yang benar bisa ditemukan & dibuang.
    invalidateDashboardCache({ classId })

    setUsedMembership(registrationRow?.used_membership === true)
    setSuccess(true)
    setSubmitting(false)
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    const needsTransferInstructions = !isFree && !usedMembership && method === 'transfer'
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

        {usedMembership ? (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-left mb-4">
            <p className="text-xs text-violet-700">
              Terdaftar pakai paket membership kamu ✅. Sesi akan dipotong otomatis saat kamu hadir nanti. Tidak perlu bayar lagi. Sampai jumpa di kelas! 💪
            </p>
          </div>
        ) : needsTransferInstructions ? (
          proofFailed ? (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-left mb-4">
              <p className="text-xs font-semibold text-yellow-700 mb-1">⚠️ Bukti transfer gagal terupload otomatis:</p>
              <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Transfer pembayaran sebesar <strong>{formatRupiah(classPrice)}</strong> (kalau belum)</li>
                <li>Kirim bukti transfer ke instruktur manual via WhatsApp</li>
                <li>Tunggu konfirmasi dari instruktur</li>
              </ol>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left mb-4">
              <p className="text-xs text-green-700">
                Bukti transfer <strong>{formatRupiah(classPrice)}</strong> sudah kami terima ✅. Instruktur akan cek dan konfirmasi pembayaranmu. Tidak perlu kirim ulang ya.
              </p>
            </div>
          )
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

        {needsTransferInstructions && proofFailed && waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo, saya ${name} (${phone}) baru mendaftar untuk ${className}. Berikut bukti transfer saya.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-11 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors mb-2"
          >
            <Phone className="w-4 h-4" />
            Kirim Bukti Transfer via WhatsApp
          </a>
        )}

        <Link
          href={`/${slug}`}
          className="flex items-center justify-center gap-1.5 w-full h-9 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Halaman Utama
        </Link>
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

        {skipPayment && (
          <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-xs text-violet-700">
            Nomor ini terdaftar sebagai member dengan paket aktif - tidak perlu bayar, sesi akan dipotong dari paketmu saat hadir.
          </div>
        )}

        {!isFree && !skipPayment && showToggle && (
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

        {!isFree && !skipPayment && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50 border border-violet-100">
            <p className="text-sm text-gray-600">Total pembayaran</p>
            <span className="text-xl font-bold text-violet-700">{formatRupiah(classPrice)}</span>
          </div>
        )}

        {!isFree && !skipPayment && method === 'transfer' && (
          <PaymentMethodsDisplay methods={paymentMethods} />
        )}

        {!isFree && !skipPayment && method === 'transfer' && (
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
          ) : isFree || skipPayment ? (
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
