import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { RegistrationForm } from '@/components/public/RegistrationForm'
import { formatDate, formatTime, formatRupiah } from '@/lib/utils'
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'

// Service-role client (key statis) + GET fetch → rentan kena Next.js Data
// Cache, jadi kuota/isFull bisa basi. Paksa selalu fetch ulang per request.
export const dynamic = 'force-dynamic'

export default async function PublicRegistrationPage({
  params,
}: {
  params: Promise<{ slug: string; eventSlug: string }>
}) {
  const { slug, eventSlug } = await params
  const supabase = createServiceClient()

  // Cari profil instruktur berdasarkan slug
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, business_name, phone')
    .eq('slug', slug)
    .single()

  if (!profile) notFound()

  // Cari event yang sudah dipublikasikan
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', profile.id)
    .eq('slug', eventSlug)
    .eq('status', 'published')
    .single()

  if (!event) notFound()

  // Hitung kuota early bird yang tersisa
  const { count: earlyBirdUsed } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('tier', 'early_bird')

  const ebDeadlinePassed = event.early_bird_deadline
    ? new Date(event.early_bird_deadline) < new Date()
    : false

  const ebQuotaFull = event.early_bird_quota !== null
    ? (earlyBirdUsed ?? 0) >= event.early_bird_quota
    : false

  const earlyBirdAvailable =
    Number(event.early_bird_price) > 0 &&
    !ebDeadlinePassed &&
    !ebQuotaFull

  // Hitung total pendaftar
  const { count: totalRegistrations } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id)

  const isFull = event.max_capacity !== null
    ? (totalRegistrations ?? 0) >= event.max_capacity
    : false

  return (
    <div className="max-w-lg mx-auto px-4 py-8">

      {/* Instructor badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-xs text-gray-500">Diselenggarakan oleh</p>
          <p className="text-sm font-semibold text-gray-800">
            {profile.business_name ?? profile.name}
          </p>
        </div>
      </div>

      {/* Event card */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6 shadow-sm">
        {event.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-48 object-cover"
          />
        )}

        <div className="p-5">
          <h1 className="text-xl font-bold text-gray-900 mb-3">{event.title}</h1>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDays className="w-4 h-4 text-violet-500 shrink-0" />
              {formatDate(event.event_date)}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-violet-500 shrink-0" />
              {formatTime(event.start_time)}
              {event.end_time && <> – {formatTime(event.end_time)}</>}
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-violet-500 shrink-0" />
                {event.location}
                {event.google_maps_url && (
                  <a
                    href={event.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-violet-600 hover:underline"
                  >
                    Lihat Lokasi
                  </a>
                )}
              </div>
            )}
            {event.max_capacity && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-violet-500 shrink-0" />
                {totalRegistrations ?? 0} / {event.max_capacity} peserta
              </div>
            )}
          </div>

          {/* Smart Pricing */}
          {earlyBirdAvailable ? (
            <div className="mb-2">
              <div className="p-3 bg-green-50 border-2 border-green-300 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-green-700">Early Bird 🔥</p>
                  {event.early_bird_quota && (
                    <p className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                      Sisa {event.early_bird_quota - (earlyBirdUsed ?? 0)} slot
                    </p>
                  )}
                </div>
                <p className="text-2xl font-bold text-green-800 mt-0.5">
                  {formatRupiah(Number(event.early_bird_price))}
                </p>
              </div>
              {Number(event.ots_price) > 0 && (
                <p className="text-xs text-gray-400 text-center mt-1.5">
                  Harga naik ke{' '}
                  <span className="font-medium text-gray-500">{formatRupiah(Number(event.ots_price))}</span>
                  {' '}setelah kuota Early Bird habis
                </p>
              )}
            </div>
          ) : (
            <div className="mb-2">
              {Number(event.early_bird_price) > 0 && (
                <p className="text-xs text-gray-400 line-through text-center mb-1">
                  Early Bird: {formatRupiah(Number(event.early_bird_price))} - Habis
                </p>
              )}
              <div className="p-3 bg-violet-50 border-2 border-violet-300 rounded-xl">
                <p className="text-xs font-semibold text-violet-700">
                  {Number(event.early_bird_price) > 0 ? 'OTS' : 'Harga Tiket'}
                </p>
                <p className="text-2xl font-bold text-violet-800 mt-0.5">
                  {formatRupiah(Number(event.ots_price))}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Registration form or full notice */}
      {isFull ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-red-700 mb-1">Pendaftaran Ditutup</p>
          <p className="text-xs text-red-500">Kapasitas event sudah penuh.</p>
        </div>
      ) : (
        <RegistrationForm
          eventId={event.id}
          userId={profile.id}
          instructorPhone={profile.phone}
          earlyBirdAvailable={earlyBirdAvailable}
          earlyBirdPrice={Number(event.early_bird_price)}
          otsPrice={Number(event.ots_price)}
          pricingMode={(event.pricing_mode === 'single' || Number(event.early_bird_price) === 0) ? 'single' : 'tiered'}
          eventTitle={event.title}
          eventDescription={event.description ?? null}
        />
      )}
    </div>
  )
}
