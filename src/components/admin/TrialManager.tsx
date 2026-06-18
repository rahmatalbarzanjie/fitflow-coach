'use client'

import { useState } from 'react'

interface Props {
  profileId: string
  currentStatus: string
  trialExpiresAt: string | null
}

const inp = 'w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'

export function TrialManager({ profileId, currentStatus, trialExpiresAt }: Props) {
  const [open,        setOpen]        = useState(false)
  const [confirmEnd,  setConfirmEnd]  = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState('')

  const [amount,   setAmount]   = useState('')
  const [method,   setMethod]   = useState('transfer')
  const [duration, setDuration] = useState('1')
  const [notes,    setNotes]    = useState('')

  async function extend(months: number) {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/extend-trial', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profileId, action: 'extend', months }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Gagal memperpanjang trial'); return }
    setDone(true)
    setOpen(false)
    setTimeout(() => { setDone(false); window.location.reload() }, 1200)
  }

  async function recordPayment() {
    if (!amount || Number(amount) <= 0) { setError('Jumlah pembayaran wajib diisi'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/record-payment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        profileId,
        amount:         Number(amount),
        method,
        durationMonths: Number(duration),
        notes:          notes || undefined,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Gagal mencatat pembayaran'); return }
    setDone(true)
    setShowPayForm(false)
    setOpen(false)
    setTimeout(() => { setDone(false); window.location.reload() }, 1200)
  }

  async function endAccessNow() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/extend-trial', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profileId, action: 'end' }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Gagal mengakhiri akses'); return }
    setDone(true)
    setOpen(false)
    setConfirmEnd(false)
    setTimeout(() => { setDone(false); window.location.reload() }, 1200)
  }

  if (done) return <span className="text-xs text-green-600 font-medium">Disimpan ✓</span>

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-violet-600 hover:text-violet-800 font-medium shrink-0 ml-4"
      >
        Kelola
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-10 bg-white border border-gray-100 rounded-xl shadow-lg p-3 w-56 space-y-1.5">
          {confirmEnd ? (
            <>
              {error && <p className="text-[10px] text-red-500 px-1">{error}</p>}
              <p className="text-xs text-gray-600 px-1 mb-1">
                Akhiri {currentStatus === 'active' ? 'langganan' : 'trial'} sekarang? Instruktur ini akan langsung diarahkan ke halaman akses habis.
              </p>
              <div className="flex gap-1.5">
                <button onClick={() => setConfirmEnd(false)} disabled={saving} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500">
                  Batal
                </button>
                <button onClick={endAccessNow} disabled={saving} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">
                  Ya, Akhiri
                </button>
              </div>
            </>
          ) : showPayForm ? (
            <>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Catat Pembayaran</p>
              {error && <p className="text-[10px] text-red-500 px-1">{error}</p>}
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Jumlah (Rp)" className={inp} />
              <select value={method} onChange={e => setMethod(e.target.value)} className={inp}>
                <option value="transfer">Transfer</option>
                <option value="cash">Tunai</option>
                <option value="other">Lainnya</option>
              </select>
              <select value={duration} onChange={e => setDuration(e.target.value)} className={inp}>
                <option value="1">1 bulan</option>
                <option value="3">3 bulan</option>
                <option value="6">6 bulan</option>
                <option value="12">12 bulan</option>
              </select>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan (opsional)" className={inp} />
              <div className="flex gap-1.5 pt-1">
                <button onClick={() => { setShowPayForm(false); setError('') }} disabled={saving} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500">
                  Batal
                </button>
                <button onClick={recordPayment} disabled={saving} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium">
                  Simpan
                </button>
              </div>
            </>
          ) : (
            <>
              {error && <p className="text-[10px] text-red-500 px-1 mb-1">{error}</p>}
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Perpanjang Trial (gratis)</p>
              {[1, 3, 6].map(m => (
                <button
                  key={m}
                  onClick={() => extend(m)}
                  disabled={saving}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-violet-50 hover:text-violet-700 transition-colors"
                >
                  + {m} bulan
                </button>
              ))}
              <hr className="border-gray-100 my-1" />
              <button
                onClick={() => setShowPayForm(true)}
                disabled={saving}
                className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-green-50 hover:text-green-700 text-green-600 font-medium transition-colors"
              >
                Catat Pembayaran
              </button>
              <button
                onClick={() => setConfirmEnd(true)}
                disabled={saving}
                className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-700 text-red-500 font-medium transition-colors"
              >
                {currentStatus === 'active' ? 'Akhiri Langganan Sekarang' : 'Akhiri Trial Sekarang'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-400"
              >
                Tutup
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
