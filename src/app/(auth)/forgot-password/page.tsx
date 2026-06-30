'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'

const inputClass = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow'

export default function ForgotPasswordPage() {
  const [step,    setStep]    = useState<1 | 2 | 'done'>(1)
  const [phone,   setPhone]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [info,    setInfo]    = useState<string | null>(null)

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone }),
    })
    const data = await res.json()
    setLoading(false)
    setInfo(data.message ?? 'Kalau nomor ini terdaftar, kode OTP akan dikirim ke WhatsApp kamu.')
    setStep(2)
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, otp, newPassword: password }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'Gagal reset password.'); return }
    setStep('done')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-600 rounded-2xl mb-4 shadow-lg shadow-violet-200">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">FuelOS</h1>
          <p className="text-sm text-gray-500 mt-1">Reset password lewat WhatsApp</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 'done' ? (
            <div className="text-center space-y-3">
              <p className="text-sm font-semibold text-gray-900">Password berhasil diubah 🎉</p>
              <p className="text-sm text-gray-500">Silakan login dengan password barumu.</p>
              <Link
                href="/login"
                className="inline-block w-full h-10 leading-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Ke Halaman Masuk
              </Link>
            </div>
          ) : step === 1 ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <p className="text-sm text-gray-500">
                Masukkan nomor WhatsApp yang terdaftar di akun kamu. Kode OTP akan dikirim ke nomor itu.
              </p>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Nomor WhatsApp</label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  required
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              {info && (
                <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 text-sm text-violet-700">{info}</div>
              )}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">Kode OTP</label>
                <input
                  id="otp"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="6 digit kode"
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password Baru</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">Konfirmasi Password</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Ulangi password baru"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Menyimpan...' : 'Reset Password'}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); setOtp('') }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
              >
                Belum dapat kode? Kirim ulang
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link href="/login" className="text-violet-600 font-medium hover:underline">
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </div>
  )
}
