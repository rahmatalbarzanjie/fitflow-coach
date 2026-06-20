import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { RegistrationsList } from '@/components/events/RegistrationsList'
import { formatDateShort } from '@/lib/utils'

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [evRes, regsRes] = await Promise.all([
    supabase.from('events').select('id, title, event_date, status')
      .eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('event_registration_summary').select('*')
      .eq('event_id', id).order('registered_at', { ascending: false }),
  ])

  if (!evRes.data) notFound()
  const ev   = evRes.data
  const regs = (regsRes.data ?? []) as any[]

  const total     = regs.length
  const pending   = regs.filter(r => r.payment_status === 'pending').length
  const confirmed = regs.filter(r => r.payment_status === 'confirmed').length
  const attended  = regs.filter(r => r.attended).length

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader
        backHref={`/events/${id}`}
        title="Kelola Peserta"
        subtitle={`${ev.title} · ${formatDateShort(ev.event_date)}`}
      />

      {/* Summary ringkas */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Daftar',    value: total,     color: 'text-gray-900' },
          { label: 'Menunggu',  value: pending,   color: pending > 0 ? 'text-orange-500' : 'text-gray-900' },
          { label: 'Konfirmasi',value: confirmed, color: 'text-green-600' },
          { label: 'Hadir',     value: attended,  color: 'text-violet-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-2.5 text-center">
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* List peserta — client-side filter */}
      <RegistrationsList
        registrations={regs}
        eventId={id}
        userId={user!.id}
        eventStatus={ev.status}
      />
    </div>
  )
}
