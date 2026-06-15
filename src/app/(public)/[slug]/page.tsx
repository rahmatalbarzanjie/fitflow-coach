import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { CalendarDays, Clock, MapPin, ChevronRight, Phone, Zap, Star, Users, Trophy, Heart } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatTime, formatRupiah, DAY_NAMES } from '@/lib/utils'

export default async function InstructorLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase  = createServiceClient()

  // First query without photo_url (safe for all migration states)
  const { data: profileBase } = await supabase
    .from('profiles')
    .select('id, name, business_name, phone, slug')
    .eq('slug', slug)
    .single()

  if (!profileBase) notFound()

  // Try to get photo_url (added in migration 004 — graceful fallback if missing)
  let photo_url: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photoData } = await (supabase.from('profiles') as any)
    .select('photo_url')
    .eq('id', profileBase.id)
    .single()
  photo_url = (photoData as any)?.photo_url ?? null

  const profile = { ...profileBase, photo_url }

  const today = new Date().toISOString().split('T')[0]

  const [eventsRes, classesRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, event_date, start_time, end_time, location, ots_price, early_bird_price, max_capacity, cover_image_url')
      .eq('user_id', profile.id)
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date')
      .limit(6),

    supabase
      .from('classes')
      .select('id, name, type, day_of_week, start_time, end_time, location, capacity')
      .eq('user_id', profile.id)
      .order('day_of_week')
      .order('start_time'),
  ])

  const events  = eventsRes.data  as any[] | null
  const classes = classesRes.data as any[] | null

  const studio   = profile.business_name ?? profile.name
  const waNumber = profile.phone?.replace(/\D/g, '').replace(/^0/, '62')

  const poundfitClasses = classes?.filter(c => c.type === 'poundfit') ?? []
  const barreClasses    = classes?.filter(c => c.type === 'barre')    ?? []
  const otherClasses    = classes?.filter(c => !['poundfit', 'barre'].includes(c.type)) ?? []

  const whyPoints = [
    { icon: Star,   text: 'Info jadwal & event lebih awal',    color: 'bg-amber-50  text-amber-500'  },
    { icon: Trophy, text: 'Harga spesial untuk member tetap',   color: 'bg-green-50  text-green-500'  },
    { icon: Heart,  text: 'Masuk komunitas fitness eksklusif',  color: 'bg-rose-50   text-rose-500'   },
    { icon: Users,  text: 'Prioritas slot event & workshop',    color: 'bg-violet-50 text-violet-500' },
  ]

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 px-4 bg-gradient-to-br from-violet-600 via-violet-500 to-fuchsia-500">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'2\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
        />
        <div className="max-w-xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/30">
            <Zap className="w-3 h-3" />
            Fitness Studio
          </div>

          {/* Instructor photo */}
          {profile.photo_url && (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.photo_url}
                alt={profile.name}
                className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-white/40 shadow-xl"
              />
            </div>
          )}

          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-3 drop-shadow-sm">
            {studio}
          </h1>
          <p className="text-white/80 text-base md:text-lg mb-2">Instruktur: {profile.name}</p>
          <p className="text-white/60 text-sm mb-8">
            {[poundfitClasses.length > 0 && 'Poundfit', barreClasses.length > 0 && 'Barre Intensity', otherClasses.length > 0 && 'Kelas Fitness']
              .filter(Boolean).join(' · ')}
          </p>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent('Halo ' + studio + '! Aku mau tanya-tanya soal kelas 😊')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-6 py-3 rounded-full text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Phone className="w-4 h-4" />
              Chat WhatsApp
            </a>
          )}
        </div>
      </section>

      {/* ── POUNDFIT (Rock theme) ─────────────────────────────────────────── */}
      {poundfitClasses.length > 0 && (
        <section className="py-16 px-4 bg-gray-950">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 bg-red-500 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-red-500/30">
                🥁
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wider">Poundfit</h2>
                <p className="text-red-400 text-xs font-semibold">Cardio Drumming · Rock Your Body 🤘</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-6 mt-2">Bakar kalori sambil dengerin musik rock! Energi penuh, feel good setiap sesi.</p>
            <div className="space-y-2.5">
              {poundfitClasses.map(cls => (
                <div key={cls.id} className="p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-red-500/40 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{cls.name}</p>
                      <p className="text-red-400 text-sm mt-0.5">
                        {DAY_NAMES[cls.day_of_week]} · {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      </p>
                      {cls.location && <p className="text-gray-600 text-xs mt-0.5">{cls.location}</p>}
                    </div>
                    {cls.capacity && (
                      <span className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 px-3 py-1 rounded-full font-medium shrink-0">
                        Maks {cls.capacity}
                      </span>
                    )}
                  </div>
                  {(cls as any).description && (
                    <p className="text-gray-500 text-xs mt-2 leading-relaxed">{(cls as any).description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BARRE (Pinky girl theme) ─────────────────────────────────────── */}
      {barreClasses.length > 0 && (
        <section className="py-16 px-4 bg-gradient-to-br from-rose-50 to-pink-50">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 bg-rose-400 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-rose-300/40">
                🩰
              </div>
              <div>
                <h2 className="text-2xl font-black text-rose-700 uppercase tracking-wider">Barre Intensity</h2>
                <p className="text-rose-400 text-xs font-semibold">Ballet-Inspired · Sculpt &amp; Tone 🩷</p>
              </div>
            </div>
            <p className="text-rose-400/80 text-sm mb-6 mt-2">Gerakan ballet dipadukan latihan intensitas tinggi — untuk tubuh kuat dan anggun.</p>
            <div className="space-y-2.5">
              {barreClasses.map(cls => (
                <div key={cls.id} className="p-4 bg-white border border-rose-100 rounded-2xl hover:border-rose-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{cls.name}</p>
                      <p className="text-rose-500 text-sm mt-0.5">
                        {DAY_NAMES[cls.day_of_week]} · {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      </p>
                      {cls.location && <p className="text-gray-400 text-xs mt-0.5">{cls.location}</p>}
                    </div>
                    {cls.capacity && (
                      <span className="text-xs bg-rose-50 text-rose-400 border border-rose-200 px-3 py-1 rounded-full font-medium shrink-0">
                        Maks {cls.capacity}
                      </span>
                    )}
                  </div>
                  {(cls as any).description && (
                    <p className="text-rose-400 text-xs mt-2 leading-relaxed">{(cls as any).description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── OTHER CLASSES ─────────────────────────────────────────────────── */}
      {otherClasses.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Kelas Lainnya</h2>
            <div className="space-y-2.5">
              {otherClasses.map(cls => (
                <div key={cls.id} className="p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{cls.name}</p>
                      <p className="text-violet-500 text-sm mt-0.5">
                        {DAY_NAMES[cls.day_of_week]} · {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      </p>
                      {cls.location && <p className="text-gray-400 text-xs mt-0.5">{cls.location}</p>}
                    </div>
                    {cls.capacity && (
                      <span className="text-xs bg-violet-50 text-violet-500 border border-violet-100 px-3 py-1 rounded-full font-medium shrink-0">
                        Maks {cls.capacity}
                      </span>
                    )}
                  </div>
                  {(cls as any).description && (
                    <p className="text-gray-500 text-xs mt-2 leading-relaxed">{(cls as any).description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── UPCOMING EVENTS ───────────────────────────────────────────────── */}
      {events && events.length > 0 && (
        <section className="py-16 px-4 bg-white">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-violet-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900">Event Mendatang</h2>
            </div>
            <p className="text-gray-400 text-sm mb-8">Daftar sekarang — slot terbatas! 🔥</p>
            <div className="space-y-4">
              {(events as any[]).map(ev => {
                const isPriced  = ev.pricing_mode === 'tiered'
                const tier1Ok   = Number(ev.early_bird_price) > 0
                const evDate    = new Date(ev.event_date)
                const daysUntil = Math.ceil((evDate.getTime() - new Date(today).getTime()) / 86_400_000)

                return (
                  <div key={ev.id} className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                    {ev.cover_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.cover_image_url} alt={ev.title} className="w-full h-44 object-cover" />
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-bold text-gray-900 text-base leading-snug">{ev.title}</h3>
                        {daysUntil >= 0 && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                            daysUntil <= 3 ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-600'
                          }`}>
                            {daysUntil === 0 ? 'Hari ini!' : `${daysUntil} hari lagi`}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 mb-4 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-violet-400 shrink-0" />
                          {formatDate(ev.event_date)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                          {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-violet-400 shrink-0" />
                            {ev.location}
                          </div>
                        )}
                      </div>

                      {/* Pricing */}
                      {isPriced && tier1Ok ? (
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-2.5 text-center">
                            <p className="text-xs text-green-600 font-semibold">{ev.tier1_label || 'Gelombang 1'}</p>
                            <p className="text-base font-black text-green-700 mt-0.5">{formatRupiah(Number(ev.early_bird_price))}</p>
                          </div>
                          <div className="text-gray-300 text-xs">→</div>
                          <div className="flex-1 bg-violet-50 border border-violet-100 rounded-xl p-2.5 text-center">
                            <p className="text-xs text-violet-600 font-semibold">{ev.tier2_label || 'Gelombang 2'}</p>
                            <p className="text-base font-black text-violet-700 mt-0.5">{formatRupiah(Number(ev.ots_price))}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4">
                          <span className="text-2xl font-black text-gray-900">{formatRupiah(Number(ev.ots_price))}</span>
                        </div>
                      )}

                      <Link
                        href={`/${slug}/daftar/${ev.slug}`}
                        className="flex items-center justify-center gap-2 w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition-colors"
                      >
                        Daftar Sekarang <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── KENAPA JADI MEMBER ───────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gradient-to-br from-violet-50 to-fuchsia-50">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Kenapa Jadi Member?</h2>
            <p className="text-gray-400 text-sm">Nikmati lebih banyak keuntungan sebagai member tetap</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {whyPoints.map(({ icon: Icon, text, color }) => (
              <div key={text} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color.split(' ')[0]}`}>
                  <Icon className={`w-5 h-5 ${color.split(' ')[1]}`} />
                </div>
                <p className="text-sm font-medium text-gray-800 leading-snug">{text}</p>
              </div>
            ))}
          </div>
          {waNumber && (
            <div className="mt-8 text-center">
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent('Halo! Aku mau daftar jadi member tetap ' + studio + ' 😊')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-3 rounded-full text-sm shadow-md hover:shadow-lg transition-all"
              >
                <Phone className="w-4 h-4" />
                Daftar Jadi Member
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600 rounded-2xl mb-4">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <p className="text-white font-black text-2xl mb-1">{studio}</p>
        <p className="text-gray-400 text-sm mb-5">Instruktur: {profile.name}</p>
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 text-sm transition-colors"
          >
            <Phone className="w-4 h-4" />
            {profile.phone}
          </a>
        )}
        <p className="text-gray-700 text-xs mt-8">Powered by FitFlow Coach</p>
      </footer>
    </div>
  )
}
