'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, UserPlus, Loader2, Send, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  registrationId: string
  eventId: string
  userId: string
  paymentStatus: string
  registrantName: string
  registrantPhone: string
  canInviteToJoin: boolean
  isInvited: boolean
  // Hapus permanen hanya dipakai di halaman booking kelas (data uji/dummy
  // butuh cara dibersihkan manual oleh instruktur) - TIDAK ditampilkan di
  // halaman pendaftaran event, yang cukup pakai konfirmasi/tolak.
  allowDelete?: boolean
}

async function notifyRegistrant(
  registrationId: string,
  type: 'confirm' | 'reject' | 'invite',
  reason?: string
) {
  try {
    await fetch('/api/notifications/registration', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ registrationId, type, reason }),
    })
  } catch {
    // notifikasi WA gagal tidak perlu blokir UI
  }
}

export function RegistrationActions({
  registrationId,
  userId,
  paymentStatus,
  registrantName,
  registrantPhone,
  canInviteToJoin,
  isInvited,
  allowDelete = false,
}: Props) {
  const router  = useRouter()
  const supabase = createClient()

  const [confirming,  setConfirming]  = useState(false)
  const [rejecting,   setRejecting]   = useState(false)
  const [rejectNote,  setRejectNote]  = useState('')
  const [inviting,    setInviting]    = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [confirmingDel, setConfirmingDel] = useState(false)
  const [notifSent,   setNotifSent]   = useState<'confirm' | 'reject' | 'invite' | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  async function confirm() {
    setConfirming(true)
    setError(null)
    const { error: err } = await supabase.rpc('confirm_registration', {
      p_registration_id: registrationId,
    })
    if (err) {
      setError(err.message)
    } else {
      // Kirim notif WA ke peserta (fire and forget)
      notifyRegistrant(registrationId, 'confirm').then(() => setNotifSent('confirm'))
      router.refresh()
    }
    setConfirming(false)
  }

  async function rejectFinal() {
    setError(null)
    const { error: err } = await supabase
      .from('registrations')
      .update({ payment_status: 'rejected', rejection_note: rejectNote || null })
      .eq('id', registrationId)
    if (err) {
      setError(err.message)
    } else {
      // Kirim notif WA ke peserta
      notifyRegistrant(registrationId, 'reject', rejectNote || undefined).then(() => setNotifSent('reject'))
      setRejecting(false)
      router.refresh()
    }
  }

  async function inviteToJoin() {
    setInviting(true)
    setError(null)

    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', registrantPhone)
      .single()

    let memberId: string | null = existing?.id ?? null

    if (!memberId) {
      const { data: newMember, error: createErr } = await supabase
        .from('members')
        .insert({ user_id: userId, name: registrantName, phone: registrantPhone })
        .select('id')
        .single()
      if (createErr) { setError(createErr.message); setInviting(false); return }
      memberId = newMember?.id ?? null
    }

    const { error: inviteErr } = await supabase.rpc('invite_registrant_to_join', {
      p_registration_id: registrationId,
      p_member_id:       memberId,
    })
    if (inviteErr) {
      setError(inviteErr.message)
    } else {
      notifyRegistrant(registrationId, 'invite').then(() => setNotifSent('invite'))
      router.refresh()
    }
    setInviting(false)
  }

  async function deleteRegistration() {
    setDeleting(true)
    setError(null)
    const { error: err } = await supabase
      .from('registrations')
      .delete()
      .eq('id', registrationId)
    if (err) {
      setError(err.message)
      setDeleting(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Notif WA terkirim */}
      {notifSent && (
        <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
          <Send className="w-2.5 h-2.5" />
          WA {notifSent === 'confirm' ? 'konfirmasi' : notifSent === 'invite' ? 'undangan member' : 'penolakan'} terkirim
        </span>
      )}

      <div className="flex items-center gap-1.5">
        {/* Confirm */}
        {paymentStatus === 'pending' && (
          <button
            onClick={confirm}
            disabled={confirming}
            className="flex items-center gap-1 h-7 px-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
          >
            {confirming
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <CheckCircle className="w-3 h-3" />}
            Konfirmasi
          </button>
        )}

        {/* Reject */}
        {(paymentStatus === 'pending' || paymentStatus === 'confirmed') && !rejecting && (
          <button
            onClick={() => setRejecting(true)}
            className="flex items-center gap-1 h-7 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors"
          >
            <XCircle className="w-3 h-3" />
            Tolak
          </button>
        )}

        {/* Invite to member */}
        {canInviteToJoin && !isInvited && (
          <button
            onClick={inviteToJoin}
            disabled={inviting}
            className="flex items-center gap-1 h-7 px-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
          >
            {inviting
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <UserPlus className="w-3 h-3" />}
            Undang Jadi Member
          </button>
        )}

        {isInvited && (
          <span className="text-xs text-gray-400 italic">Sudah diundang</span>
        )}

        {/* Hapus permanen - khusus booking kelas, untuk bersihkan data uji */}
        {allowDelete && !confirmingDel && (
          <button
            onClick={() => setConfirmingDel(true)}
            className="flex items-center gap-1 h-7 px-2.5 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Hapus
          </button>
        )}
      </div>

      {/* Inline delete confirm */}
      {allowDelete && confirmingDel && (
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-xs text-gray-500">Hapus booking ini permanen?</span>
          <button
            onClick={deleteRegistration}
            disabled={deleting}
            className="h-7 px-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
          >
            {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
            Ya, Hapus
          </button>
          <button
            onClick={() => setConfirmingDel(false)}
            className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition-colors"
          >
            Batal
          </button>
        </div>
      )}

      {/* Inline reject form */}
      {rejecting && (
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <input
            type="text"
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="Alasan penolakan (opsional)"
            autoFocus
            className="h-7 px-2 rounded-lg border border-red-200 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 w-44"
          />
          <button
            onClick={rejectFinal}
            className="h-7 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Kirim Tolak + WA
          </button>
          <button
            onClick={() => { setRejecting(false); setRejectNote('') }}
            className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition-colors"
          >
            Batal
          </button>
        </div>
      )}
    </div>
  )
}
