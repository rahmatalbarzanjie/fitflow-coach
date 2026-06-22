import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { Badge } from '@/components/ui/badge'
import { FeedbackRequestButtonEvent } from '@/components/events/FeedbackRequestButtonEvent'
import {
  Users, Settings, MessageSquareWarning,
  CalendarDays, Clock, MapPin, ExternalLink,
} from 'lucide-react'
import { formatDate, formatTime, formatRupiah } from '@/lib/utils'
import { EVENT_STATUS } from '@/lib/constants'

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'blue' | 'red'> = {
  draft: 'gray', published: 'green', completed: 'blue', cancelled: 'red',
}

export default async function EventHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [evRes, regsRes, profileRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('registrations')
      .select('id, payment_status, amount_paid, attended, confirmed_at')
      .eq('event_id', id),
    supabase.from('profiles').select('slug').eq('id', user!.id).single(),
  ])

  const ev = evRes.data
  if (!ev) notFound()

  const regs      = (regsRes.data ?? []) as any[]
  const total     = regs.length
  const pending   = regs.filter(r => r.payment_status === 'pending').length
  const confirmed = regs.filter(r => r.payment_status === 'confirmed').length
  const attended  = regs.filter(r => r.attended).length
  // Revenue = uang yang PERNAH dikonfirmasi diterima (fakta historis),
  // bukan status saat ini - kalau registrasi confirmed lalu dibatalkan,
  // revenue-nya tetap terhitung (lihat audit Revenue Settlement).
  const revenue   = regs
    .filter(r => r.confirmed_at !== null)
    .reduce((s, r) => s + Number(r.amount_paid), 0)

  const rawUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const appUrl    = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl
  const slug      = profileRes.data?.slug
  const publicUrl = slug && appUrl ? `${appUrl}/${slug}/daftar/${ev.slug}` : null

  const statusLabel = EVENT_STATUS[ev.status as keyof typeof EVENT_STATUS]?.label ?? ev.status

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader
        backHref="/events"
        title={ev.title}
        action={
          <Badge color={STATUS_COLOR[ev.status] ?? 'gray'}>
            {statusLabel}
          </Badge>
        }
      />

      {/* KPI Cards — terbaca dalam 1 detik */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Daftar',    value: total,     color: 'text-gray-900'   },
          { label: 'Menunggu',  value: pending,   color: pending > 0 ? 'text-orange-500' : 'text-gray-900' },
          { label: 'Konfirmasi', value: confirmed, color: 'text-green-600'  },
          { label: 'Revenue',   value: formatRupiah(revenue), color: 'text-violet-600', small: true },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className={`font-bold leading-tight ${kpi.small ? 'text-xs' : 'text-xl'} ${kpi.color}`}>
              {kpi.value}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Section: Info */}
      <SectionList label="Info">
        <DetailRow
          icon={<CalendarDays className="w-4 h-4" />}
          label="Tanggal"
          value={formatDate(ev.event_date)}
          chevron={false}
        />
        <DetailRow
          icon={<Clock className="w-4 h-4" />}
          label="Jam"
          value={`${formatTime(ev.start_time)}${ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}`}
          chevron={false}
        />
        {ev.location && (
          <DetailRow
            icon={<MapPin className="w-4 h-4" />}
            label="Lokasi"
            value={ev.location}
            chevron={false}
          />
        )}
        {publicUrl && (
          <DetailRow
            icon={<ExternalLink className="w-4 h-4" />}
            label="Landing Page Event"
            sublabel={ev.status === 'published' ? 'Tap untuk buka link pendaftaran' : 'Event belum dipublikasikan'}
            href={ev.status === 'published' ? publicUrl : undefined}
            disabled={ev.status !== 'published'}
          />
        )}
      </SectionList>

      {/* Section: Operasional */}
      <SectionList label="Operasional">
        <DetailRow
          icon={<Users className="w-4 h-4" />}
          label="Kelola Peserta"
          sublabel={
            pending > 0
              ? `${pending} peserta menunggu konfirmasi`
              : `${total} peserta · ${confirmed} terkonfirmasi · ${attended} hadir`
          }
          href={`/events/${id}/registrations`}
          badge={pending > 0 ? (
            <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
              {pending}
            </span>
          ) : undefined}
        />
        <DetailRow
          icon={<MessageSquareWarning className="w-4 h-4" />}
          label="Minta Feedback"
          sublabel={attended > 0 ? `${attended} peserta sudah hadir` : 'Belum ada peserta yang hadir'}
          disabled={attended === 0}
          href={attended > 0 ? undefined : undefined}
          chevron={attended > 0}
          onClick={undefined}
        />
      </SectionList>

      {/* Section: Pengaturan */}
      <SectionList label="Pengaturan">
        <DetailRow
          icon={<Settings className="w-4 h-4" />}
          label="Pengaturan Event"
          sublabel="Status, harga, rekening, dan hapus"
          href={`/events/${id}/settings`}
        />
      </SectionList>

      {/* FeedbackRequestButton — hidden, dipakai via operasional */}
      {attended > 0 && (
        <div className="mt-2">
          <FeedbackRequestButtonEvent eventId={id} />
        </div>
      )}
    </div>
  )
}
