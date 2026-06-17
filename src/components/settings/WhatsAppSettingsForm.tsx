'use client'

import { useState } from 'react'
import { Eye, EyeOff, Check, Loader2, RefreshCw, AlertCircle } from 'lucide-react'

interface Props {
  initialBotPhone: string
  initialHasToken: boolean
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function WhatsAppSettingsForm({ initialBotPhone, initialHasToken }: Props) {
  const [botPhone, setBotPhone] = useState(initialBotPhone)
  const [token,    setToken   ] = useState('')
  const [hasToken, setHasToken] = useState(initialHasToken)
  const [showToken, setShowToken] = useState(false)
  const [saving,   setSaving  ] = useState(false)
  const [saved,    setSaved   ] = useState(false)
  const [error,    setError   ] = useState('')

  const [testing,  setTesting ] = useState(false)
  const [groups,   setGroups  ] = useState<{ id: string; name: string }[] | null>(null)
  const [testError, setTestError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bot_phone: botPhone, fonnte_token: token || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal simpan')
      } else {
        setSaved(true)
        if (token) { setHasToken(true); setToken('') }
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setTestError('')
    setGroups(null)
    try {
      const res = await fetch('/api/wa/groups')
      const data = await res.json()
      if (!res.ok) {
        setTestError(data.error ?? 'Gagal terhubung')
      } else {
        setGroups(data.groups ?? [])
      }
    } catch {
      setTestError('Koneksi gagal')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Nomor Bot WhatsApp</label>
        <p className="text-xs text-gray-400">
          Nomor khusus untuk broadcast & otomasi — beda dari nomor pribadi kamu di atas. Harus nomor yang sama
          dengan yang dipakai untuk membuat/mengelola grup komunitas kelas kamu.
        </p>
        <input
          value={botPhone}
          onChange={e => setBotPhone(e.target.value)}
          placeholder="0812xxxxxxxx"
          className={inp}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Token Fonnte</label>
        <p className="text-xs text-gray-400">
          Dapatkan token di dashboard fonnte.com setelah menghubungkan nomor bot di atas.
          {hasToken && <span className="text-green-600 font-medium"> Token sudah tersimpan.</span>}
        </p>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={hasToken ? '•••••••• (isi untuk ganti)' : 'Tempel token di sini'}
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
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? 'Tersimpan' : 'Simpan'}
        </button>
        <button
          onClick={testConnection}
          disabled={testing || !hasToken}
          className="h-9 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Tes Koneksi & Lihat Grup
        </button>
      </div>

      {testError && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {testError}
        </p>
      )}

      {groups !== null && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-2">
            {groups.length === 0 ? 'Tidak ada grup ditemukan' : `${groups.length} grup ditemukan:`}
          </p>
          <ul className="space-y-1">
            {groups.map(g => (
              <li key={g.id} className="text-xs text-gray-500">• {g.name}</li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            Untuk menghubungkan grup ke kelas tertentu, buka halaman detail kelas.
          </p>
        </div>
      )}
    </div>
  )
}
