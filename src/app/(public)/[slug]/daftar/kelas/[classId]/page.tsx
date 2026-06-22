import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { ClassRegistrationForm } from '@/components/public/ClassRegistrationForm'
import { formatTime, formatRupiah, DAY_NAMES } from '@/lib/utils'
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'

// Service-role client (key statis) + GET fetch → rentan kena Next.js Data
// Cache, jadi kuota/isFull bisa basi. Paksa selalu fetch ulang per request.
export const dynamic = 'force-dynamic'

// Tentukan tanggal kemunculan kelas berikutnya: pakai tanggal reschedule
// kalau ada override dalam 14 hari ke depan, kalau tidak hitung dari
// day_of_week (kuota harus reset tiap minggu, jadi bukan FK ke sessions).
function nextOccurrence(dayOfWeek: number, from: Date) {
  const diff = (dayOfWeek - from.getDay() + 7) % 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export default async function ClassRegistrationPage({
  params,
}: {
  params: Promise<{ slug: string; classId: string }>
}) {
  const { slug, classId } = await params
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, business_name, phone')
    .eq('slug', slug)
    .single()
  if (!profile) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cls } = await (supabase.from('classes') as any)
    .select('id, name, type, day_of_week, start_time, end_time, location, google_maps_url, capacity, class_price, is_active, payment_profile_id')
    .eq('id', classId)
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .single()
  if (!cls) notFound()

  // Metode pembayaran dari Payment Profile kelas ini - tampilkan semua,
  // peserta pilih sendiri.
  const { data: paymentMethods } = cls.payment_profile_id
    ? await supabase
        .from('payment_methods')
        .select('id, method_type, bank_name, account_number, account_name, qris_image_url')
        .eq('payment_profile_id', cls.payment_profile_id)
        .order('sort_order')
    : { data: [] }

  const today = new Date()
  const in14Days = new Date(today)
  in14Days.setDate(in14Days.getDate() + 14)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reschedSess } = await (supabase.from('sessions') as any)
    .select('session_date')
    .eq('class_id', classId)
    .eq('session_type', 'rescheduled')
    .gte('session_date', today.toISOString().split('T')[0])
    .lte('session_date', in14Days.toISOString().split('T')[0])
    .order('session_date')
    .limit(1)
    .maybeSingle()

  const targetDate = reschedSess?.session_date ?? nextOccurrence(cls.day_of_week, today)

  const { count: registeredCount } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('session_date', targetDate)
    .in('payment_status', ['pending', 'confirmed'])

  const isFull = cls.capacity !== null && (registeredCount ?? 0) >= cls.capacity
  const classPrice = Number(cls.class_price) || 0

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <span className="font-semibold text-gray-600">{profile.business_name ?? profile.name}</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="p-5">
          <h1 className="text-lg font-bold text-gray-900 mb-3">{cls.name}</h1>
          <div className="space-y-1.5 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              {DAY_NAMES[new Date(targetDate + 'T00:00:00').getDay()]}, {new Date(targetDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
            </p>
            {cls.location && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                {cls.location}
                {cls.google_maps_url && (
                  <a
                    href={cls.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-violet-600 hover:underline"
                  >
                    Lihat Lokasi
                  </a>
                )}
              </p>
            )}
            {cls.capacity && (
              <p className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                {registeredCount ?? 0} / {cls.capacity} peserta
              </p>
            )}
          </div>

          {classPrice > 0 && (
            <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-violet-50 border border-violet-100">
              <span className="text-sm text-gray-600">Harga per sesi</span>
              <span className="text-lg font-bold text-violet-700">{formatRupiah(classPrice)}</span>
            </div>
          )}
        </div>
      </div>

      {isFull ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-red-700">Pendaftaran Ditutup</p>
          <p className="text-xs text-red-500 mt-1">Kuota untuk sesi ini sudah penuh.</p>
        </div>
      ) : (
        <ClassRegistrationForm
          classId={cls.id}
          userId={profile.id}
          instructorPhone={profile.phone}
          targetDate={targetDate}
          className={cls.name}
          classPrice={classPrice}
          paymentMethods={(paymentMethods as any[]) ?? []}
        />
      )}
    </div>
  )
}
