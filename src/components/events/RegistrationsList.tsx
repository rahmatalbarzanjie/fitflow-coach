'use client'

/**
 * RegistrationsList — Daftar peserta event dengan:
 * - Filter client-side (tidak reload)
 * - Preview bukti transfer (sheet/dialog)
 * - AttendanceToggle + RegistrationActions
 * - Feedback section di bawah
 */

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { RegistrationActions } from '@/components/events/RegistrationActions'
import { AttendanceToggle } from '@/components/events/AttendanceToggle'
import { formatDateShort, formatRupiah } from '@/lib/utils'
import { PAYMENT_STATUS, REGISTRATION_TIER } from '@/lib/constants'
import { Image as ImageIcon, X, Users, ExternalLink } from 'lucide-react'

const STATUS_COLOR: Record<string, 'yellow' | 'green' | 'red' | 'gray'> = {
  pending:   'yellow',
  confirmed: 'green',
  rejected:  'red',
}

const STATUS_TABS = [
  { key: '',          label: 'Semua'      },
  { key: 'pending',   label: 'Menunggu'   },
  { key: 'confirmed', label: 'Konfirmasi' },
  { key: 'rejected',  label: 'Ditolak'   },
]

interface Reg {
  id:               string
  registrant_name:  string
  registrant_phone: string
  payment_status:   string
  amount_paid:      number | string
  tier:             string
  registered_at:    string
  attended:         boolean
  proof_url:        string | null
  rejection_note:   string | null
  is_member:        boolean
  can_invite_to_join: boolean
  invited_to_join_at: string | null
}

interface Props {
  registrations: Reg[]
  eventId:       string
  userId:        string
  eventStatus:   string
}

// ─── Bukti Transfer Sheet ─────────────────────────────────────────────────────

function ProofSheet({
  reg,
  onClose,
}: {
  reg: Reg
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl z-10 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-gray-900">{reg.registrant_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatRupiah(Number(reg.amount_paid))} · {formatDateShort(reg.registered_at)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gambar bukti — lazy load */}
        <div className="flex-1 overflow-y-auto">
          {reg.proof_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={reg.proof_url}
              alt="Bukti transfer"
              loading="lazy"
              className="w-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <p className="text-sm">Tidak ada bukti transfer</p>
            </div>
          )}
        </div>

        {/* Aksi konfirmasi dari sheet */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <RegistrationActions
            registrationId={reg.id}
            eventId=""
            userId=""
            paymentStatus={reg.payment_status}
            registrantName={reg.registrant_name}
            registrantPhone={reg.registrant_phone}
            canInviteToJoin={reg.can_invite_to_join}
            isInvited={!!reg.invited_to_join_at}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RegistrationsList({ registrations, eventId, userId, eventStatus }: Props) {
  const [statusFilter, setStatusFilter] = useState('')
  const [proofReg,     setProofReg    ] = useState<Reg | null>(null)

  const pending = registrations.filter(r => r.payment_status === 'pending').length

  const filtered = useMemo(() =>
    statusFilter ? registrations.filter(r => r.payment_status === statusFilter) : registrations
  , [registrations, statusFilter])

  return (
    <>
      {/* Filter pills — client-side */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              statusFilter === tab.key
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.key === 'pending' && pending > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 rounded-full">
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {statusFilter ? 'Tidak ada peserta dengan status ini' : 'Belum ada peserta'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {filtered.map(r => (
            <div key={r.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                {/* Info peserta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900">{r.registrant_name}</p>
                    <Badge color={STATUS_COLOR[r.payment_status] ?? 'gray'}>
                      {PAYMENT_STATUS[r.payment_status as keyof typeof PAYMENT_STATUS]?.label ?? r.payment_status}
                    </Badge>
                    <Badge color="gray">
                      {REGISTRATION_TIER[r.tier as keyof typeof REGISTRATION_TIER]?.label ?? r.tier}
                    </Badge>
                    {r.is_member && <Badge color="violet">Member</Badge>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {r.registrant_phone}
                    <span className="mx-1.5">·</span>
                    {formatRupiah(Number(r.amount_paid))}
                    <span className="mx-1.5">·</span>
                    {formatDateShort(r.registered_at)}
                  </p>
                  {r.rejection_note && (
                    <p className="text-xs text-red-500 mt-1 italic">"{r.rejection_note}"</p>
                  )}

                  {/* Tombol lihat bukti transfer */}
                  {r.proof_url && (
                    <button
                      onClick={() => setProofReg(r)}
                      className="mt-1.5 flex items-center gap-1 text-xs text-violet-600 hover:underline"
                    >
                      <ImageIcon className="w-3 h-3" /> Lihat bukti transfer
                    </button>
                  )}
                </div>

                {/* Aksi */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <AttendanceToggle registrationId={r.id} attended={!!r.attended} />
                  <RegistrationActions
                    registrationId={r.id}
                    eventId={eventId}
                    userId={userId}
                    paymentStatus={r.payment_status}
                    registrantName={r.registrant_name}
                    registrantPhone={r.registrant_phone}
                    canInviteToJoin={!!r.can_invite_to_join}
                    isInvited={!!r.invited_to_join_at}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proof sheet */}
      {proofReg && (
        <ProofSheet reg={proofReg} onClose={() => setProofReg(null)} />
      )}
    </>
  )
}
