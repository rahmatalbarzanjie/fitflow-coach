'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Check, Loader2, RefreshCw, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'

interface Props {
  initialBotPhone: string
  initialBotPhoneRequested: string
  initialHasToken: boolean
}

type Status = 'none' | 'pending' | 'connecting' | 'connected'

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function WhatsAppSettingsForm({ initialBotPhone, initialBotPhoneRequested, initialHasToken }: Props) {
  const initialStatus: Status = initialBotPhone
    ? 'connected'
    : initialHasToken
      ? 'connecting'
      : initialBotPhoneRequested
        ? 'pending'
        : 'none'

  const [status,    setStatus]    = useState<Status>(initialStatus)
  const [phone,     setPhone]     = useState('')
  const [botPhone,  setBotPhone]  = useState(initialBotPhone)
  const [qr,        setQr]        = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [error,     setError]     = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function requestLink() {
    if (!phone.trim() || phone.trim().length < 9) { setError('Isi nomor WhatsApp yang valid'); return }
    setRequesting(true)
    setError('')
    const res = await fetch('/api/wa/request-link', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone: phone.trim() }),
    })
    const data = await res.json()
    setRequesting(false)
    if (!res.ok) { setError(data.error ?? 'Gagal mengajukan'); return }
    setStatus('pending')
  }

  async function pollStatus() {
    const res = await fetch('/api/wa/connect-status')
    if (!res.ok) return
    const data = await res.json()
    if (data.connected) {
      setStatus('connected')
      if (data.phone) setBotPhone(data.phone)
      if (pollRef.current) clearInterval(pollRef.current)
    } else if (data.qr) {
      setQr(data.qr)
    }
  }

  useEffect(() => {
    if (status === 'connecting') {
      pollStatus()
      pollRef.current = setInterval(pollStatus, 3000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [status])

  if (status === 'connected') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-700">Bot WA terhubung: <strong>{botPhone}</strong></p>
        </div>
        <ManualTokenFallback />
      </div>
    )
  }

  if (status === 'connecting') {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl text-center">
          <p className="text-sm font-medium text-violet-700 mb-3">Scan QR ini dengan WhatsApp di nomor bot kamu</p>
          {qr ? (
            <img src={`data:image/png;base64,${qr}`} alt="QR Code" className="mx-auto w-48 h-48 rounded-lg border border-violet-200" />
          ) : (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          )}
          <p className="text-xs text-violet-500 mt-3 flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin" /> Menunggu hasil scan...
          </p>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <Clock className="w-4 h-4 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-700">Menunggu verifikasi admin untuk nomor <strong>{initialBotPhoneRequested}</strong></p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nomor WhatsApp untuk Bot</label>
        <p className="text-xs text-amber-600">
          Gunakan nomor khusus, bukan nomor pribadi — nomor ini akan terlihat oleh member kamu.
        </p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="0812xxxxxxxx"
            className={inp}
          />
          <button
            onClick={requestLink}
            disabled={requesting}
            className="h-9 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ajukan Tautkan'}
          </button>
        </div>
      </div>
      <ManualTokenFallback />
    </div>
  )
}

function ManualTokenFallback() {
  const [open,     setOpen]     = useState(false)
  const [token,    setToken]    = useState('')
  const [showToken, setShowToken] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fonnte_token: token || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal simpan')
      } else {
        setSaved(true)
        setToken('')
        setTimeout(() => { setSaved(false); window.location.reload() }, 1500)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gray-400 hover:text-gray-600 underline">
        Sudah punya device Fonnte sendiri? Isi token manual
      </button>
    )
  }

  return (
    <div className="space-y-1.5 pt-2 border-t border-gray-100">
      <label className="block text-sm font-medium text-gray-700">Token Fonnte (manual)</label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Tempel token di sini"
            className={inp}
            style={{ paddingRight: '2.25rem' }}
          />
          <button
            type="button"
            onClick={() => setShowToken(v => !v)}
            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={save}
          disabled={saving || !token}
          className="h-9 px-4 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
          Simpan
        </button>
      </div>
    </div>
  )
}
