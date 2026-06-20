'use client'

/**
 * WhatsAppConnectFlow — flow koneksi WhatsApp via Fonnte.
 * Diekstrak dari WhatsAppSettingsForm yang lama.
 * Hanya tampil di /settings/whatsapp/connect.
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

type Status = 'idle' | 'requesting' | 'pending' | 'connecting' | 'connected' | 'error'

export function WhatsAppConnectFlow() {
  const router = useRouter()
  const [phone,    setPhone   ] = useState('')
  const [status,   setStatus  ] = useState<Status>('idle')
  const [qr,       setQr      ] = useState<string | null>(null)
  const [error,    setError   ] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function requestLink() {
    if (!phone.trim() || phone.trim().length < 9) {
      setError('Masukkan nomor WhatsApp yang valid')
      return
    }
    setStatus('requesting')
    setError('')
    try {
      const res  = await fetch('/api/wa/request-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Gagal meminta koneksi'); setStatus('error'); return }
      setStatus('pending')
      startPolling()
    } catch {
      setError('Gagal terhubung ke server')
      setStatus('error')
    }
  }

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch('/api/wa/connect-status')
        const data = await res.json()
        if (data.connected) {
          clearInterval(pollRef.current!)
          setStatus('connected')
          setTimeout(() => router.push('/settings/whatsapp'), 1500)
        } else if (data.qr) {
          setQr(data.qr)
          setStatus('connecting')
        }
      } catch { /* polling silently fails */ }
    }, 3000)
  }

  const inp = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

  return (
    <div className="space-y-4">
      {/* Step: input nomor */}
      {(status === 'idle' || status === 'error') && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Nomor WhatsApp Bot</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Masukkan nomor HP yang akan dipakai sebagai bot. Nomor ini <strong>berbeda</strong> dengan nomor pribadi kamu dan khusus untuk broadcast & notifikasi otomatis.
            </p>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className={inp}
            autoFocus
          />
          <button
            onClick={requestLink}
            disabled={status === 'requesting'}
            className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {status === 'requesting' && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === 'requesting' ? 'Memproses...' : 'Lanjutkan'}
          </button>
        </div>
      )}

      {/* Step: pending / QR scan */}
      {(status === 'pending' || status === 'connecting') && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center space-y-4">
          {status === 'pending' && (
            <>
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-gray-900">Menyiapkan koneksi...</p>
              <p className="text-xs text-gray-400">Harap tunggu, QR code akan muncul sebentar lagi</p>
            </>
          )}
          {status === 'connecting' && qr && (
            <>
              <p className="text-sm font-semibold text-gray-900">Scan QR Code</p>
              <p className="text-xs text-gray-400 mb-2">
                Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Scan kode ini
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl border border-gray-200" />
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Menunggu scan...
              </div>
            </>
          )}
        </div>
      )}

      {/* Step: connected */}
      {status === 'connected' && (
        <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-base font-bold text-green-700">WhatsApp Terhubung!</p>
          <p className="text-xs text-green-600 mt-1">Mengalihkan ke halaman WhatsApp...</p>
        </div>
      )}
    </div>
  )
}
