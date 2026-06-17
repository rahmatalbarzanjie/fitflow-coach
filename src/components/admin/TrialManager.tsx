'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  profileId: string
  currentStatus: string
  trialExpiresAt: string | null
}

export function TrialManager({ profileId, currentStatus, trialExpiresAt }: Props) {
  const [open,        setOpen]        = useState(false)
  const [confirmEnd,  setConfirmEnd]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)
  const supabase = createClient()

  async function extend(months: number) {
    setSaving(true)
    const base = trialExpiresAt && new Date(trialExpiresAt) > new Date()
      ? new Date(trialExpiresAt)
      : new Date()
    base.setMonth(base.getMonth() + months)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ trial_expires_at: base.toISOString(), subscription_status: 'trial' })
      .eq('id', profileId)

    setSaving(false)
    setDone(true)
    setOpen(false)
    setTimeout(() => { setDone(false); window.location.reload() }, 1200)
  }

  async function activate() {
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ subscription_status: 'active', trial_expires_at: null })
      .eq('id', profileId)
    setSaving(false)
    window.location.reload()
  }

  async function endTrialNow() {
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ trial_expires_at: new Date().toISOString() })
      .eq('id', profileId)
    setSaving(false)
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
        <div className="absolute right-0 top-6 z-10 bg-white border border-gray-100 rounded-xl shadow-lg p-3 w-48 space-y-1.5">
          {confirmEnd ? (
            <>
              <p className="text-xs text-gray-600 px-1 mb-1">
                Akhiri trial sekarang? Instruktur ini akan langsung diarahkan ke halaman trial habis.
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setConfirmEnd(false)}
                  disabled={saving}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500"
                >
                  Batal
                </button>
                <button
                  onClick={endTrialNow}
                  disabled={saving}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  Ya, Akhiri
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Perpanjang Trial</p>
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
                onClick={activate}
                disabled={saving}
                className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-green-50 hover:text-green-700 text-green-600 font-medium transition-colors"
              >
                Aktifkan Langganan
              </button>
              {currentStatus !== 'active' && (
                <button
                  onClick={() => setConfirmEnd(true)}
                  disabled={saving}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-700 text-red-500 font-medium transition-colors"
                >
                  Akhiri Trial Sekarang
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-400"
              >
                Batal
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
