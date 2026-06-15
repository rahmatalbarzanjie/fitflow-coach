import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatDate, formatTime, formatRupiah, DAY_NAMES } from '@/lib/utils'
import { PublicNavbar } from '../_components/PublicNavbar'

// ── Class type config ─────────────────────────────────────────────────────────
const CLASS_CONFIG: Record<string, {
  label: string; subtitle: string; icon: string
  gradFrom: string; gradTo: string
  accentText: string; accentBg: string; dayText: string
}> = {
  poundfit: {
    label: 'POUNDFIT', subtitle: 'Cardio Drumming • Rock Your Body 🤘',
    icon: 'fitness_center', gradFrom: '#F87171', gradTo: '#F43F5E',
    accentText: 'text-red-500', accentBg: 'bg-red-50', dayText: 'text-red-500',
  },
  barre: {
    label: 'BARRE', subtitle: 'Ballet-Inspired • Sculpt & Tone 💗',
    icon: 'self_improvement', gradFrom: '#FDA4AF', gradTo: '#FB7185',
    accentText: 'text-rose-600', accentBg: 'bg-rose-50', dayText: 'text-rose-500',
  },
  zumba: {
    label: 'ZUMBA', subtitle: 'Dance • Cardio • Pure Energy ✨',
    icon: 'music_note', gradFrom: '#2DD4BF', gradTo: '#0D9488',
    accentText: 'text-teal-600', accentBg: 'bg-teal-50', dayText: 'text-teal-600',
  },
}

function getTypeConfig(type: string) {
  return CLASS_CONFIG[type?.toLowerCase()] ?? {
    label: (type ?? 'KELAS').toUpperCase(), subtitle: 'Kelas Fitness',
    icon: 'sports', gradFrom: '#8B5CF6', gradTo: '#7C3AED',
    accentText: 'text-violet-600', accentBg: 'bg-violet-50', dayText: 'text-violet-500',
  }
}

function countdownBadge(daysUntil: number) {
  if (daysUntil <= 0)  return { label: 'Hari Ini!',           bg: 'bg-red-600' }
  if (daysUntil === 1) return { label: '1 Hari Lagi',          bg: 'bg-red-600' }
  if (daysUntil <= 7)  return { label: `${daysUntil} Hari Lagi`, bg: 'bg-amber-700' }
  return                      { label: `${daysUntil} Hari Lagi`, bg: 'bg-indigo-700' }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function InstructorLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug }   = await params
  const supabase   = createServiceClient()
  const today      = new Date().toISOString().split('T')[0]

  // Profile
  const { data: profileBase } = await supabase
    .from('profiles')
    .select('id, name, business_name, phone, slug')
    .eq('slug', slug)
    .single()

  if (!profileBase) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photoData } = await (supabase.from('profiles') as any)
    .select('photo_url').eq('id', profileBase.id).single()

  const profile = { ...profileBase, photo_url: (photoData as any)?.photo_url ?? null }

  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysStr = in7Days.toISOString().split('T')[0]

  // Classes + Events + Sessions with changes in next 7 days
  const [classesRes, eventsRes, changedSessionsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, type, day_of_week, start_time, end_time, location, capacity')
      .eq('user_id', profile.id)
      .order('day_of_week').order('start_time'),
    supabase
      .from('events')
      .select('id, title, slug, event_date, start_time, end_time, location, ots_price, early_bird_price, early_bird_deadline, max_capacity, cover_image_url')
      .eq('user_id', profile.id)
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date')
      .limit(6),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('sessions') as any)
      .select('id, class_id, session_date, start_time, end_time, session_type, original_date, original_time, override_location')
      .eq('user_id', profile.id)
      .neq('session_type', 'regular')
      .gte('session_date', today)
      .lte('session_date', in7DaysStr)
      .order('session_date'),
  ])

  const classes        = classesRes.data         ?? []
  const events         = eventsRes.data          ?? []
  const changedSessions: any[] = changedSessionsRes.data ?? []

  // Build maps for quick lookup
  const rescheduledMap = new Map<string, any>() // class_id → session (rescheduled)
  const locationMap    = new Map<string, any>() // class_id → session (location_changed)
  const extraSessions: any[] = []

  changedSessions.forEach((s: any) => {
    if (s.session_type === 'rescheduled')      rescheduledMap.set(s.class_id, s)
    else if (s.session_type === 'location_changed') locationMap.set(s.class_id, s)
    else if (s.session_type === 'extra')        extraSessions.push(s)
  })

  // Registration counts
  const regCountMap: Record<string, number> = {}
  if (events.length > 0) {
    const { data: regs } = await supabase
      .from('registrations')
      .select('event_id')
      .in('event_id', events.map(e => e.id))
      .in('payment_status', ['pending', 'confirmed'])
    regs?.forEach((r: any) => { regCountMap[r.event_id] = (regCountMap[r.event_id] || 0) + 1 })
  }

  // Group classes by type
  const classGroups = Object.entries(
    classes.reduce((acc: Record<string, any[]>, cls: any) => {
      const t = (cls.type || 'lainnya').toLowerCase()
      ;(acc[t] ??= []).push(cls)
      return acc
    }, {})
  )

  const studio   = profile.business_name ?? profile.name
  const waNumber = profile.phone?.replace(/\D/g, '').replace(/^0/, '62')
  const waMsg    = encodeURIComponent(`Halo ${studio}! Aku mau tanya-tanya soal kelas 😊`)

  const HERO_GRADIENT  = 'linear-gradient(135deg, #FFD1FF 0%, #D1E9FF 100%)'
  const CLASS_SUBTITLE = classGroups.map(([t]) => getTypeConfig(t).label).join(' · ')

  return (
    <div className="min-h-screen bg-white text-on-surface font-sans">
      <PublicNavbar studio={studio} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden"
        style={{ background: HERO_GRADIENT }}
      >
        <div className="relative z-10 flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-indigo-700 mb-6 shadow-sm">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            <span className="text-xs font-bold tracking-widest uppercase">Fitness Studio</span>
          </div>

          {/* Photo */}
          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-indigo-400/20 rounded-full blur-3xl group-hover:bg-pink-400/30 transition-all duration-500" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.photo_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(studio)}&size=256&background=4f46e5&color=fff&bold=true`}
              alt={studio}
              className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-white shadow-2xl relative z-10"
            />
          </div>

          {/* Name */}
          <h1 className="font-montserrat text-4xl sm:text-5xl md:text-[72px] lg:text-[88px] font-extralight text-on-surface mb-2 leading-tight tracking-tight break-words max-w-[90vw] text-center">
            {studio}
          </h1>
          <p className="font-montserrat italic font-light text-on-surface/70 mb-10 tracking-wide text-lg">
            {CLASS_SUBTITLE || 'Poundfit • Barre Intensity • Kelas Fitness'}
          </p>

          {/* WA Button */}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-700 text-white px-10 py-4 rounded-full font-bold flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all group"
            >
              <span className="material-symbols-outlined">chat</span>
              Chat WhatsApp
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </a>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <span className="material-symbols-outlined text-on-surface/30">keyboard_double_arrow_down</span>
        </div>
      </section>

      {/* ── CLASS SCHEDULE ───────────────────────────────────────────────── */}
      {classGroups.length > 0 && (
        <section className="py-24 md:py-32 bg-white" id="schedules">
          <div className="max-w-container-max mx-auto px-4 md:px-10">
            <div className="mb-16">
              <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-on-surface mb-3">Jadwal Kelas</h2>
              <p className="text-on-surface-variant max-w-xl">
                Pilih sesi yang sesuai dengan ritme kamu. Setiap kelas dirancang untuk hasil maksimal dengan energi yang menular.
              </p>
            </div>

            <div className={`grid grid-cols-1 gap-6 ${
              classGroups.length === 1 ? 'max-w-md' :
              classGroups.length === 2 ? 'sm:grid-cols-2 max-w-3xl' :
              'sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {classGroups.map(([type, typeClasses]) => {
                const cfg = getTypeConfig(type)
                return (
                  <div key={type} className="flex flex-col gap-6">
                    {/* Column header */}
                    <div
                      className="flex items-center gap-4 p-6 rounded-t-3xl text-white"
                      style={{ background: `linear-gradient(to right, ${cfg.gradFrom}, ${cfg.gradTo})` }}
                    >
                      <span className="material-symbols-outlined text-4xl">{cfg.icon}</span>
                      <div>
                        <h3 className="font-montserrat text-2xl font-bold uppercase">{cfg.label}</h3>
                        <p className="text-white/80 text-sm">{cfg.subtitle}</p>
                      </div>
                    </div>

                    {/* Class cards */}
                    <div className="flex flex-col gap-4">
                      {(typeClasses as any[]).map((cls: any) => {
                        const reschedSess = rescheduledMap.get(cls.id)
                        const locSess     = locationMap.get(cls.id)
                        const displayLoc  = locSess?.override_location ?? cls.location
                        return (
                        <div
                          key={cls.id}
                          className="p-6 rounded-2xl bg-white border border-outline-variant hover-lift custom-shadow"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-1.5">
                              <span className={`px-3 py-1 ${cfg.accentBg} ${cfg.accentText} font-bold rounded-lg text-xs uppercase tracking-wider self-start`}>
                                {reschedSess
                                  ? DAY_NAMES[new Date(reschedSess.session_date + 'T00:00:00').getDay()]
                                  : DAY_NAMES[cls.day_of_week]}
                              </span>
                              {reschedSess && (
                                <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium self-start">
                                  ⚠️ Jadwal Berubah
                                </span>
                              )}
                              {locSess && (
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium self-start">
                                  📍 Lokasi Berubah
                                </span>
                              )}
                            </div>
                            {cls.capacity && (
                              <span className="bg-surface-variant text-on-surface-variant px-3 py-1 rounded-full text-xs font-medium">
                                Maks {cls.capacity}
                              </span>
                            )}
                          </div>
                          <h4 className="font-montserrat text-lg font-bold text-on-surface mb-1">{cls.name}</h4>
                          <p className={`text-sm flex items-center gap-1.5 mb-1 ${cfg.dayText}`}>
                            <span className="material-symbols-outlined text-base">schedule</span>
                            {reschedSess
                              ? <>{formatTime(reschedSess.start_time)} – {formatTime(reschedSess.end_time)} <span className="text-on-surface-variant/50 line-through text-xs">{formatTime(cls.start_time)}</span></>
                              : <>{formatTime(cls.start_time)} – {formatTime(cls.end_time)}</>
                            }
                          </p>
                          {displayLoc && (
                            <p className="text-on-surface-variant text-sm flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-base">location_on</span>
                              {locSess ? (
                                <>
                                  <span className="line-through text-on-surface-variant/40 text-xs">{cls.location}</span>
                                  <span className="font-semibold text-on-surface">{locSess.override_location}</span>
                                </>
                              ) : displayLoc}
                            </p>
                          )}
                          {reschedSess && reschedSess.original_date && (
                            <p className="text-on-surface-variant/50 text-xs mt-1">
                              Biasanya {DAY_NAMES[cls.day_of_week]} {formatTime(cls.start_time)}
                            </p>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── KELAS TAMBAHAN MINGGU INI ─────────────────────────────────── */}
      {extraSessions.length > 0 && (
        <section className="py-16 bg-emerald-50/50">
          <div className="max-w-container-max mx-auto px-4 md:px-10">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-emerald-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
              <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-on-surface">⚡ Kelas Tambahan Minggu Ini</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(extraSessions as any[]).map((s: any) => {
                const clsInfo = classes.find((c: any) => c.id === s.class_id)
                return (
                  <div key={s.id} className="bg-white rounded-2xl p-5 border-2 border-emerald-200 shadow-sm">
                    <span className="inline-block text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-3">
                      Kelas Ekstra
                    </span>
                    <h4 className="font-montserrat text-lg font-bold text-on-surface mb-2">
                      {clsInfo?.name ?? 'Kelas Ekstra'}
                    </h4>
                    <p className="text-sm text-on-surface-variant flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-base text-emerald-500">calendar_today</span>
                      {DAY_NAMES[new Date(s.session_date + 'T00:00:00').getDay()]}, {formatDate(s.session_date).split(',')[1]?.trim()}
                    </p>
                    <p className="text-sm text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-500">schedule</span>
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── EVENTS ───────────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <section className="py-24 bg-gray-50 relative overflow-hidden" id="events">
          <div className="absolute top-0 left-0 w-full h-1 opacity-20"
            style={{ background: 'linear-gradient(to right, #4f46e5, #fd56a7, #2DD4BF)' }} />
          <div className="max-w-container-max mx-auto px-4 md:px-10">
            <div className="flex items-center gap-3 mb-12">
              <span className="material-symbols-outlined text-indigo-700 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                event_upcoming
              </span>
              <h2 className="font-montserrat text-3xl md:text-5xl font-bold text-on-surface">Event Mendatang</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(events as any[]).map(ev => {
                const evDate    = new Date(ev.event_date)
                const daysUntil = Math.ceil((evDate.getTime() - new Date(today).getTime()) / 86_400_000)
                const badge     = countdownBadge(daysUntil)
                const regCount  = regCountMap[ev.id] ?? 0
                const capacity  = ev.max_capacity ?? 0
                const fillPct   = capacity > 0 ? Math.min(100, Math.round(regCount / capacity * 100)) : 0

                const ebValid = Number(ev.early_bird_price) > 0 &&
                  ev.early_bird_deadline &&
                  new Date(ev.early_bird_deadline) >= new Date()
                const displayPrice = ebValid ? Number(ev.early_bird_price) : Number(ev.ots_price)

                return (
                  <div key={ev.id} className="bg-white rounded-3xl overflow-hidden custom-shadow hover-lift group">
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden">
                      {ev.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ev.cover_image_url}
                          alt={ev.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #fd56a7 100%)' }}
                        />
                      )}
                      <div className={`absolute top-4 right-4 ${badge.bg} text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg`}>
                        {badge.label}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 md:p-8">
                      <h3 className="font-montserrat text-xl md:text-2xl font-bold text-on-surface mb-4 break-words leading-tight">{ev.title}</h3>

                      <div className="space-y-3 mb-8">
                        <div className="flex items-center gap-3 text-on-surface-variant">
                          <span className="material-symbols-outlined text-indigo-700 text-xl">calendar_today</span>
                          <span className="text-sm">{formatDate(ev.event_date)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-on-surface-variant">
                          <span className="material-symbols-outlined text-indigo-700 text-xl">schedule</span>
                          <span className="text-sm">
                            {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                          </span>
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-3 text-on-surface-variant">
                            <span className="material-symbols-outlined text-indigo-700 text-xl">location_on</span>
                            <span className="text-sm">{ev.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Pricing + Slot */}
                      <div className="border-t border-outline-variant pt-6 mb-8">
                        <p className="text-xs font-bold text-outline-muted uppercase tracking-widest mb-2">Pendaftaran</p>
                        <div className="flex justify-between items-end mb-2">
                          <div>
                            <span className="font-montserrat text-2xl font-bold text-indigo-700">
                              {formatRupiah(displayPrice)}
                            </span>
                            {ebValid && (
                              <span className="ml-2 text-xs text-pink-500 font-semibold">Early Bird</span>
                            )}
                          </div>
                          {capacity > 0 && (
                            <span className="text-xs text-on-surface-variant">{regCount} / {capacity} Slot</span>
                          )}
                        </div>
                        {capacity > 0 && (
                          <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${fillPct}%`,
                                background: 'linear-gradient(to right, #4f46e5, #fd56a7)',
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/${slug}/daftar/${ev.slug}`}
                        className="btn-gradient w-full text-white font-bold py-4 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
                      >
                        Daftar Sekarang
                        <span className="material-symbols-outlined text-xl">chevron_right</span>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── BENEFITS ─────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white" id="benefits">
        <div className="max-w-container-max mx-auto px-4 md:px-10">
          <div className="text-center mb-16">
            <h2 className="font-montserrat text-3xl md:text-5xl font-bold text-on-surface mb-3">Kenapa Jadi Member?</h2>
            <p className="text-on-surface-variant">Nikmati lebih banyak keuntungan sebagai member tetap</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { icon: 'star', text: 'Info jadwal & event lebih awal', bg: 'bg-amber-50', color: 'text-amber-500' },
              { icon: 'emoji_events', text: 'Harga spesial member tetap', bg: 'bg-emerald-50', color: 'text-emerald-500' },
              { icon: 'favorite', text: 'Komunitas fitness eksklusif', bg: 'bg-rose-50', color: 'text-rose-500' },
              { icon: 'groups', text: 'Prioritas slot event & workshop', bg: 'bg-violet-50', color: 'text-violet-500' },
            ].map(({ icon, text, bg, color }) => (
              <div key={text} className="bg-white rounded-2xl p-6 border border-outline-variant custom-shadow hover-lift text-center">
                <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <span className={`material-symbols-outlined ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <p className="text-sm font-medium text-on-surface leading-snug">{text}</p>
              </div>
            ))}
          </div>
          {waNumber && (
            <div className="mt-12 text-center">
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo! Aku mau daftar jadi member tetap ${studio} 😊`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gradient inline-flex items-center gap-2 text-white font-bold px-10 py-4 rounded-full shadow-lg hover:opacity-90 hover:scale-105 transition-all"
              >
                <span className="material-symbols-outlined">chat</span>
                Daftar Jadi Member
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="py-20 px-4 md:px-10" style={{ background: HERO_GRADIENT }}>
        <div className="max-w-container-max mx-auto flex flex-col items-center text-center">
          {/* CTA */}
          <div className="mb-12 space-y-4">
            <h3 className="font-montserrat text-xl font-bold text-on-surface">Mau coba sistem ini?</h3>
            <a
              href="https://wa.me/6282254049695"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-indigo-700 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined">contact_support</span>
              Kontak Developer
            </a>
          </div>

          {/* Brand */}
          <div className="space-y-3">
            <p className="text-on-surface/50 text-xs uppercase tracking-widest font-bold">Developed &amp; Powered by</p>
            <p className="font-montserrat font-bold text-5xl text-white drop-shadow-sm leading-none">SIMETRI</p>
            <p className="text-on-surface/50 text-xs font-medium">IT &amp; Telemetry Solution</p>
            <p className="text-on-surface/30 text-xs pt-3">Platform by FitFlow Coach</p>
          </div>

          {/* Copyright */}
          <div className="pt-10 mt-10 border-t border-on-surface/5 w-full">
            <p className="text-on-surface/30 text-sm">
              © {new Date().getFullYear()} {studio}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
