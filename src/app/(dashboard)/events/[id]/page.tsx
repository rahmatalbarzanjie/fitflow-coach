import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, CheckCircle, Clock, TrendingUp, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EventEditForm } from '@/components/events/EventEditForm'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { formatRupiah, formatDate } from '@/lib/utils'
import { EVENT_STATUS } from '@/lib/constants'

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'blue' | 'red'> = {
  draft: 'gray', published: 'green', completed: 'blue', cancelled: 'red',
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: ev }, { data: regs }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('registrations')
      .select('id, payment_status, amount_paid, tier')
      .eq('event_id', id),
  ])

  if (!ev) notFound()

  const total     = regs?.length ?? 0
  const pending   = regs?.filter(r => r.payment_status === 'pending').length ?? 0
  const confirmed = regs?.filter(r => r.payment_status === 'confirmed').length ?? 0
  const revenue   = regs
    ?.filter(r => r.payment_status === 'confirmed')
    .reduce((s, r) => s + Number(r.amount_paid), 0) ?? 0

  // Get profile slug for public URL
  const { data: profile } = await supabase
    .from('profiles')
    .select('slug')
    .eq('id', user!.id)
    .single()

  const publicUrl = profile?.slug ? `/${profile.slug}/daftar/${ev.slug}` : null

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/events" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{ev.title}</h1>
          <Badge color={STATUS_COLOR[ev.status] ?? 'gray'}>
            {EVENT_STATUS[ev.status as keyof typeof EVENT_STATUS]?.label ?? ev.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DeleteButton table="events" id={id} redirectTo="/events" confirmText="Hapus event ini beserta semua data pendaftaran?" />
          <Link
            href={`/events/${id}/registrations`}
            className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Users className="w-4 h-4" />
            Peserta
            {pending > 0 && (
              <span className="bg-white text-violet-700 text-xs font-bold px-1.5 rounded-full">{pending}</span>
            )}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="p-3 text-center">
          <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-400">Daftar</p>
        </Card>
        <Card className="p-3 text-center">
          <Clock className="w-4 h-4 text-orange-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{pending}</p>
          <p className="text-xs text-gray-400">Menunggu</p>
        </Card>
        <Card className="p-3 text-center">
          <CheckCircle className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{confirmed}</p>
          <p className="text-xs text-gray-400">Konfirmasi</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="w-4 h-4 text-violet-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{formatRupiah(revenue)}</p>
          <p className="text-xs text-gray-400">Revenue</p>
        </Card>
      </div>

      {/* Public URL */}
      {publicUrl && ev.status === 'published' && (
        <div className="mb-6 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-green-700">Link Pendaftaran Publik</p>
            <p className="text-xs text-green-600 mt-0.5 font-mono">{publicUrl}</p>
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-green-700 hover:underline shrink-0"
          >
            Buka <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Edit form */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Informasi Event</h2>
        <EventEditForm ev={ev} />
      </Card>
    </div>
  )
}
