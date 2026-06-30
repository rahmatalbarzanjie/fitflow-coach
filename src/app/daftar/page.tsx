'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, CheckCircle, ArrowLeft } from 'lucide-react'

const inputClass = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow bg-white'

export default function DaftarPage() {
  const [form, setForm] = useState({
    name: '', business_name: '', email: '', phone: '', city: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError  ] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res  = await fetch('/api/instructor-requests', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error); return }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Pendaftaran Diterima!</h1>
          <p className="text-sm text-gray-500 mb-6">
            Kami akan meninjau pendaftaran kamu dan mengirimkan info login via WhatsApp ke nomor <strong>{form.phone}</strong> dalam 1×24 jam.
          </p>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-sm text-violet-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke beranda
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-gray-50 px-4 py-10">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/home" className="inline-block">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600 rounded-2xl mb-3 shadow-lg shadow-violet-200">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">FuelOS</h1>
          </Link>
          <p className="text-sm text-gray-500 mt-1">Daftar sebagai instruktur - trial 30 hari gratis</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Nama Instruktur <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Nama lengkap kamu"
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Nama Studio / Brand</label>
                <input
                  name="business_name"
                  value={form.business_name}
                  onChange={handleChange}
                  placeholder="Contoh: Sari Fitness"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="email@kamu.com"
                required
                className={inputClass}
              />
              <p className="text-xs text-gray-400">Ini akan menjadi email login kamu</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  No. WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="08xxxxxxxxxx"
                  required
                  className={inputClass}
                />
                <p className="text-xs text-gray-400">Info login dikirim ke sini</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Kota</label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Contoh: Jakarta"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Trial info */}
            <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
              <p className="text-xs font-semibold text-violet-700 mb-1">✨ Trial 30 Hari Gratis</p>
              <p className="text-xs text-violet-600">
                Setelah pendaftaran dikonfirmasi, kamu langsung bisa pakai semua fitur FuelOS selama 30 hari tanpa biaya.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Mengirim...
                </>
              ) : 'Kirim Pendaftaran'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-violet-600 font-medium hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
