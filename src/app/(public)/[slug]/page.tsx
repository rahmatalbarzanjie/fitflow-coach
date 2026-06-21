import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatDate, formatTime, formatRupiah, DAY_NAMES } from '@/lib/utils'
import { PublicNavbar } from '../_components/PublicNavbar'
import { ScrollReveal } from '@/components/public/ScrollReveal'
import { EventCountdown } from '@/components/public/EventCountdown'
import { ParticipantsList } from '@/components/public/ParticipantsList'
import { CommunityPickerSheet } from '@/components/public/CommunityPickerSheet'
import { CLASS_TYPES } from '@/lib/constants'

// Halaman ini pakai service-role client (key statis, tidak ada cookie per
// user) - fetch-nya jadi kandidat sempurna untuk Next.js Data Cache, yang
// menyebabkan data baru (registrasi, toggle show_registrations, dst) tidak
// langsung kelihatan. Paksa selalu fetch ulang per request.
export const dynamic = 'force-dynamic'

// ── Class type config ─────────────────────────────────────────────────────────
const CLASS_CONFIG: Record<string, {
  label: string; subtitle: string; icon: string; iconEmoji?: string
  gradFrom: string; gradTo: string
  accentText: string; accentBg: string; dayText: string
}> = {
  poundfit: {
    label: 'POUNDFIT', subtitle: 'Cardio Drumming • Rock Your Body 🤘',
    icon: 'bolt', gradFrom: '#F87171', gradTo: '#F43F5E',
    accentText: 'text-red-500', accentBg: 'bg-red-50', dayText: 'text-red-500',
  },
  barre: {
    // Emoji ballet shoe, bukan icon font - sports_gymnastics (Material
    // Symbols) keliatan kayak bela diri/yoga, bukan barre/ballet sama
    // sekali. Pakai emoji yang sama dengan dashboard (ClassCard.tsx).
    label: 'BARRE', subtitle: 'Ballet-Inspired • Sculpt & Tone 💗',
    icon: 'sports_gymnastics', iconEmoji: '🩰', gradFrom: '#FDA4AF', gradTo: '#FB7185',
    accentText: 'text-rose-600', accentBg: 'bg-rose-50', dayText: 'text-rose-500',
  },
  zumba: {
    label: 'ZUMBA', subtitle: 'Dance • Cardio • Pure Energy ✨',
    icon: 'music_note', gradFrom: '#2DD4BF', gradTo: '#0D9488',
    accentText: 'text-teal-600', accentBg: 'bg-teal-50', dayText: 'text-teal-600',
  },
  yoga: {
    label: 'YOGA', subtitle: 'Mindful Movement • Find Your Balance 🧘',
    icon: 'self_improvement', gradFrom: '#6EE7B7', gradTo: '#10B981',
    accentText: 'text-emerald-600', accentBg: 'bg-emerald-50', dayText: 'text-emerald-600',
  },
  pilates: {
    label: 'PILATES', subtitle: 'Core Strength • Build & Lengthen 🤍',
    icon: 'accessibility_new', gradFrom: '#7DD3FC', gradTo: '#0EA5E9',
    accentText: 'text-sky-600', accentBg: 'bg-sky-50', dayText: 'text-sky-600',
  },
  aerobic: {
    label: 'AEROBIC', subtitle: 'High Energy • Cardio Blast 🔥',
    icon: 'directions_run', gradFrom: '#FCD34D', gradTo: '#F59E0B',
    accentText: 'text-amber-600', accentBg: 'bg-amber-50', dayText: 'text-amber-600',
  },
}

function getTypeConfig(type: string) {
  return CLASS_CONFIG[type?.toLowerCase()] ?? {
    label: (type ?? 'KELAS').toUpperCase(), subtitle: 'Kelas Fitness',
    icon: 'fitness_center', gradFrom: '#8B5CF6', gradTo: '#7C3AED',
    accentText: 'text-violet-600', accentBg: 'bg-violet-50', dayText: 'text-violet-500',
  }
}

function nextOccurrence(dayOfWeek: number, from: Date) {
  const diff = (dayOfWeek - from.getDay() + 7) % 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
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
  const { data: extraData } = await (supabase.from('profiles') as any)
    .select('photo_url, bio, bot_phone').eq('id', profileBase.id).single()

  const profile = {
    ...profileBase,
    photo_url: (extraData as any)?.photo_url ?? null,
    bio:       (extraData as any)?.bio ?? null,
    bot_phone: (extraData as any)?.bot_phone ?? null,
  }

  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysStr = in7Days.toISOString().split('T')[0]

  // Classes + Events + Sessions with changes in next 7 days
  const [classesRes, eventsRes, changedSessionsRes, testimonialsRes, benefitsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, type, day_of_week, start_time, end_time, location, google_maps_url, capacity, description, cover_image_url, class_price, show_registrations')
      .eq('user_id', profile.id)
      .order('day_of_week').order('start_time'),
    supabase
      .from('events')
      .select('id, title, slug, event_date, start_time, end_time, location, google_maps_url, ots_price, early_bird_price, early_bird_deadline, max_capacity, cover_image_url')
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
    supabase
      .from('testimonials')
      .select('id, name, content, photo_url, rating')
      .eq('user_id', profile.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('class_type_benefits')
      .select('type, benefits, wa_invite_link')
      .eq('user_id', profile.id),
  ])

  const classes        = classesRes.data         ?? []
  const events         = eventsRes.data          ?? []
  const changedSessions: any[] = changedSessionsRes.data ?? []
  const testimonials    = testimonialsRes.data    ?? []
  const benefitsMap = Object.fromEntries(
    ((benefitsRes.data ?? []) as any[]).filter(b => b.benefits).map(b => [b.type, b.benefits])
  )
  const communityGroups = ((benefitsRes.data ?? []) as any[])
    .filter(b => b.wa_invite_link)
    .map(b => ({ type: b.type, link: b.wa_invite_link }))

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

  // Kelas dengan registrasi ditampilkan publik - hitung target tanggal sesi
  // berikutnya per kelas (pakai reschedule kalau ada), lalu ambil peserta
  // yang terdaftar untuk tanggal itu.
  const visibleClasses = classes.filter((c: any) => c.show_registrations)
  const classTargetDateMap = new Map<string, string>()
  visibleClasses.forEach((c: any) => {
    const resched = rescheduledMap.get(c.id)
    classTargetDateMap.set(c.id, resched?.session_date ?? nextOccurrence(c.day_of_week, new Date()))
  })

  const classRegMap: Record<string, { name: string }[]> = {}
  if (visibleClasses.length > 0) {
    const { data: classRegs } = await supabase
      .from('registrations')
      .select('class_id, session_date, registrant_name')
      .in('class_id', visibleClasses.map((c: any) => c.id))
      .in('payment_status', ['pending', 'confirmed'])
    classRegs?.forEach((r: any) => {
      if (classTargetDateMap.get(r.class_id) !== r.session_date) return
      ;(classRegMap[r.class_id] ??= []).push({ name: r.registrant_name.split(' ')[0] })
    })
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
  const waNumber = (profile.bot_phone ?? profile.phone)?.replace(/\D/g, '').replace(/^0/, '62')
  const waMsg    = encodeURIComponent(`Halo ${studio}! Aku mau tanya-tanya soal kelas 😊`)
  const hasContent = classGroups.length > 0 || events.length > 0

  // ── Dokumentasi Kelas ────────────────────────────────────────────────
  // Maks 3 kelas x 6 foto. Query dibatasi (LIMIT/range) per kelas - TIDAK
  // load seluruh gallery - supaya landing page tetap cepat walau instruktur
  // punya ratusan foto dokumentasi.
  const { data: classGalleryCandidates } = await supabase
    .from('class_gallery')
    .select('class_id')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const docClassIds = [...new Set((classGalleryCandidates ?? []).map((r: any) => r.class_id))].slice(0, 3)

  const classDocs = (await Promise.all(docClassIds.map(async (cid: string) => {
    const cls = classes.find((c: any) => c.id === cid)
    if (!cls) return null
    const { data: photos, count } = await supabase
      .from('class_gallery')
      .select('id, image_url', { count: 'exact' })
      .eq('class_id', cid)
      .order('sort_order')
      .range(0, 5)
    if (!photos || photos.length === 0) return null
    return { cls, photos, totalCount: count ?? photos.length }
  }))).filter((d): d is { cls: any; photos: any[]; totalCount: number } => !!d)

  // ── Dokumentasi Event ────────────────────────────────────────────────
  // Hanya event yang sudah selesai (event_date < hari ini). Maks 3 event
  // terakhir x 6 foto, mixed grid (tanpa grouping per event).
  const { data: eventGalleryCandidates } = await supabase
    .from('event_gallery')
    .select('event_id')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const candidateEventIds = [...new Set((eventGalleryCandidates ?? []).map((r: any) => r.event_id))]

  let eventDocs: { photos: any[] }[] = []
  if (candidateEventIds.length > 0) {
    const { data: pastEvents } = await supabase
      .from('events')
      .select('id')
      .in('id', candidateEventIds)
      .lt('event_date', today)
      .order('event_date', { ascending: false })
      .limit(3)

    eventDocs = (await Promise.all((pastEvents ?? []).map(async (ev: any) => {
      const { data: photos } = await supabase
        .from('event_gallery')
        .select('id, image_url')
        .eq('event_id', ev.id)
        .order('sort_order')
        .range(0, 5)
      return { photos: photos ?? [] }
    }))).filter(d => d.photos.length > 0)
  }
  const eventDocPhotos = eventDocs.flatMap(d => d.photos)

  // Hero harus selalu punya CTA. Kalau nomor WA belum ada, fallback ke
  // scroll-to-section yang paling relevan (atau ke benefits kalau belum
  // ada konten apa pun).
  const heroScrollTarget = classGroups.length > 0 ? 'schedules' : events.length > 0 ? 'events' : 'benefits'

  const HERO_GRADIENT  = 'linear-gradient(135deg, #FFD1FF 0%, #D1E9FF 100%)'

  return (
    <div className="min-h-screen bg-white text-on-surface font-sans">
      <PublicNavbar hasTestimonials={testimonials.length > 0} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden"
        style={{ background: HERO_GRADIENT }}
      >
        <div className="relative z-10 flex flex-col items-center">
          {/* Badge */}
          <div
            className="animate-on-load inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-indigo-700 mb-6 shadow-sm"
            style={{ animationDelay: '0ms' }}
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            <span className="text-xs font-bold tracking-widest uppercase">{profile.business_name ?? 'Fitness Studio'}</span>
          </div>

          {/* Photo */}
          <div className="animate-on-load relative mb-8 group" style={{ animationDelay: '120ms' }}>
            <div className="absolute inset-0 bg-indigo-400/20 rounded-full blur-3xl group-hover:bg-pink-400/30 transition-all duration-500" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.photo_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(studio)}&size=256&background=4f46e5&color=fff&bold=true`}
              alt={studio}
              className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-white shadow-2xl relative z-10"
            />
          </div>

          {/* Name */}
          <h1
            className="animate-on-load font-montserrat uppercase text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extralight text-on-surface mb-6 leading-tight tracking-tight break-words max-w-[90vw] text-center"
            style={{ animationDelay: '240ms' }}
          >
            {profile.name}
          </h1>

          {profile.bio && (
            <p
              className="animate-on-load text-on-surface-variant text-sm italic text-center mb-10 max-w-xl"
              style={{ animationDelay: '360ms' }}
            >
              {profile.bio}
            </p>
          )}

          {/* CTA - selalu ada minimal satu, WA kalau nomor tersedia,
              kalau tidak fallback scroll ke section paling relevan */}
          {waNumber ? (
            <a
              style={{ animationDelay: '480ms' }}
              href={`https://wa.me/${waNumber}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="animate-on-load bg-indigo-700 text-white px-10 py-4 rounded-full font-bold flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all group"
            >
              <span className="material-symbols-outlined">chat</span>
              Chat WhatsApp
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </a>
          ) : (
            <a
              style={{ animationDelay: '480ms' }}
              href={`#${heroScrollTarget}`}
              className="animate-on-load bg-indigo-700 text-white px-10 py-4 rounded-full font-bold flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all group"
            >
              <span className="material-symbols-outlined">
                {heroScrollTarget === 'schedules' ? 'calendar_month' : heroScrollTarget === 'events' ? 'event_upcoming' : 'groups'}
              </span>
              {heroScrollTarget === 'schedules' ? 'Lihat Jadwal Kelas' : heroScrollTarget === 'events' ? 'Lihat Event' : 'Gabung Komunitas'}
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </a>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <span className="material-symbols-outlined text-on-surface/30">keyboard_double_arrow_down</span>
        </div>
      </section>

      {/* ── EMPTY STATE — instruktur baru, belum ada kelas/event ──────────── */}
      {!hasContent && (
        <section className="py-24 bg-white" id="schedules">
          <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10 text-center">
            <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl text-violet-500">calendar_month</span>
            </div>
            <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-on-surface mb-3">
              Jadwal Sedang Disiapkan
            </h2>
            <p className="text-on-surface-variant max-w-md mx-auto mb-8">
              {studio} sedang menyiapkan kelas dan event terbaru. Hubungi langsung untuk info jadwal terdekat.
            </p>
            {waNumber && (
              <a
                href={`https://wa.me/${waNumber}?text=${waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-indigo-700 text-white px-8 py-3.5 rounded-full font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined">chat</span>
                Tanya via WhatsApp
              </a>
            )}
          </div></ScrollReveal>
        </section>
      )}

      {/* ── CLASS SCHEDULE ───────────────────────────────────────────────── */}
      {classGroups.length > 0 && (
        <section className="py-24 md:py-32 bg-white" id="schedules">
          <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10">
            <div className="mb-16">
              <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-on-surface mb-3">Jadwal Kelas</h2>
              <p className="text-on-surface-variant max-w-xl">
                Pilih sesi yang sesuai dengan ritme kamu. Setiap kelas dirancang untuk hasil maksimal dengan energi yang menular.
              </p>
            </div>

            <div className="flex flex-col gap-12">
              {classGroups.map(([type, typeClasses]) => {
                const cfg = getTypeConfig(type)
                return (
                  <div key={type} className="flex flex-col gap-6">
                    {/* Column header */}
                    <div
                      className="flex items-center gap-4 p-6 rounded-t-3xl text-white"
                      style={{ background: `linear-gradient(to right, ${cfg.gradFrom}, ${cfg.gradTo})` }}
                    >
                      {cfg.iconEmoji
                        ? <span className="text-4xl leading-none">{cfg.iconEmoji}</span>
                        : <span className="material-symbols-outlined text-4xl">{cfg.icon}</span>}
                      <div>
                        <h3 className="font-montserrat text-2xl font-bold uppercase">{cfg.label}</h3>
                        <p className="text-white/80 text-sm">{benefitsMap[type] ?? cfg.subtitle}</p>
                      </div>
                    </div>

                    {/* Class cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(typeClasses as any[]).map((cls: any) => {
                        const reschedSess = rescheduledMap.get(cls.id)
                        const locSess     = locationMap.get(cls.id)
                        const displayLoc  = locSess?.override_location ?? cls.location
                        const regNames    = classRegMap[cls.id] ?? []
                        return (
                        <div
                          key={cls.id}
                          className="rounded-2xl bg-white border border-outline-variant hover-lift custom-shadow overflow-hidden"
                        >
                          <div className="relative h-36 overflow-hidden">
                            {cls.cover_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cls.cover_image_url}
                                alt={cls.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${cfg.gradFrom}, ${cfg.gradTo})` }}
                              >
                                {cfg.iconEmoji
                                  ? <span className="text-4xl opacity-80">{cfg.iconEmoji}</span>
                                  : <span className="material-symbols-outlined text-4xl text-white/80">{cfg.icon}</span>}
                              </div>
                            )}
                          </div>
                          <div className="p-6">
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
                          {cls.description && (
                            <p className="text-xs text-on-surface-variant/80 leading-relaxed mb-2 line-clamp-2">
                              {cls.description}
                            </p>
                          )}
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
                          {cls.google_maps_url && !locSess && (
                            <a
                              href={cls.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs font-semibold inline-flex items-center gap-1 mt-0.5 ${cfg.accentText} hover:underline`}
                            >
                              <span className="material-symbols-outlined text-sm">near_me</span>
                              Lihat Lokasi
                            </a>
                          )}
                          {reschedSess && reschedSess.original_date && (
                            <p className="text-on-surface-variant/50 text-xs mt-1">
                              Biasanya {DAY_NAMES[cls.day_of_week]} {formatTime(cls.start_time)}
                            </p>
                          )}

                          {Number(cls.class_price) > 0 && (
                            <p className={`text-sm font-bold mt-2 ${cfg.accentText}`}>
                              {formatRupiah(Number(cls.class_price))}
                              <span className="text-on-surface-variant/60 font-normal text-xs"> / sesi</span>
                            </p>
                          )}

                          {cls.show_registrations && (
                            <div className="mt-3 pt-3 border-t border-outline-variant/50">
                              {cls.capacity && (
                                <div className="mb-1.5">
                                  <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                                    <span>{regNames.length} dari {cls.capacity} kuota</span>
                                  </div>
                                  <div className="h-1.5 bg-surface-variant rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${cfg.accentBg.replace('-50', '-400')}`}
                                      style={{ width: `${Math.min(100, (regNames.length / cls.capacity) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                              <ParticipantsList names={regNames.map(r => r.name)} />
                            </div>
                          )}

                          <Link
                            href={`/${slug}/daftar/kelas/${cls.id}`}
                            className={`mt-3 w-full flex items-center justify-center gap-1.5 ${cfg.accentBg} ${cfg.accentText} font-bold py-2.5 rounded-xl text-sm hover:opacity-80 transition-opacity`}
                          >
                            Daftar Kelas
                            <span className="material-symbols-outlined text-base">chevron_right</span>
                          </Link>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div></ScrollReveal>
        </section>
      )}

      {/* ── DOKUMENTASI KELAS ────────────────────────────────────────────── */}
      {classDocs.length > 0 && (
        <section className="py-16 bg-gray-50">
          <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10">
            <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-on-surface text-center mb-10">Dokumentasi Kelas</h2>
            <div className="flex flex-col gap-10">
              {classDocs.map(({ cls, photos, totalCount }) => {
                const cfg   = getTypeConfig(cls.type)
                const extra = totalCount - photos.length
                return (
                  <div key={cls.id}>
                    <h3 className={`font-montserrat text-lg font-bold mb-4 ${cfg.accentText}`}>{cls.name}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {photos.map((p: any, i: number) => (
                        <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.image_url}
                            alt={cls.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          {i === photos.length - 1 && extra > 0 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-bold">
                              +{extra} foto lainnya
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div></ScrollReveal>
        </section>
      )}

      {/* ── KELAS TAMBAHAN MINGGU INI ─────────────────────────────────── */}
      {extraSessions.length > 0 && (
        <section className="py-16 bg-emerald-50/50">
          <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10">
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
          </div></ScrollReveal>
        </section>
      )}

      {/* ── EVENTS ───────────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <section className="py-24 bg-gray-50 relative overflow-hidden" id="events">
          <div className="absolute top-0 left-0 w-full h-1 opacity-20"
            style={{ background: 'linear-gradient(to right, #4f46e5, #fd56a7, #2DD4BF)' }} />
          <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10">
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
                      <div className="absolute top-4 right-4">
                        {daysUntil <= 1 ? (
                          <EventCountdown eventDate={ev.event_date} startTime={ev.start_time} />
                        ) : (
                          <div className={`${badge.bg} text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg`}>
                            {badge.label}
                          </div>
                        )}
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
                            {ev.google_maps_url && (
                              <a
                                href={ev.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-indigo-700 hover:underline ml-auto shrink-0"
                              >
                                Lihat Lokasi
                              </a>
                            )}
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
          </div></ScrollReveal>
        </section>
      )}

      {/* ── DOKUMENTASI EVENT ────────────────────────────────────────────── */}
      {eventDocPhotos.length > 0 && (
        <section className="py-16 bg-gray-50">
          <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10">
            <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-on-surface text-center mb-3">Dokumentasi Event</h2>
            <p className="text-on-surface-variant text-center mb-10">Momen terbaik dari event-event yang sudah berlangsung</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {eventDocPhotos.map((p: any) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url}
                    alt="Dokumentasi event"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div></ScrollReveal>
        </section>
      )}

      {/* ── BENEFITS ─────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white" id="benefits">
        <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10">
          <div className="text-center mb-16">
            <h2 className="font-montserrat text-3xl md:text-5xl font-bold text-on-surface mb-3">Kenapa Bergabung dengan Komunitas {studio}?</h2>
            <p className="text-on-surface-variant">Nikmati lebih banyak keuntungan sebagai bagian dari komunitas kami</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { emoji: '💪', text: 'Lebih konsisten berolahraga bersama komunitas' },
              { emoji: '📅', text: 'Dapat reminder kelas otomatis' },
              { emoji: '🎉', text: 'Prioritas informasi event dan kelas spesial' },
              { emoji: '🎟️', text: 'Akses promo dan reward khusus member' },
              { emoji: '👭', text: 'Bertemu teman baru dengan tujuan hidup sehat yang sama' },
              { emoji: '🔥', text: 'Menjadi bagian dari komunitas aktif dan suportif' },
            ].map(({ emoji, text }) => (
              <div key={text} className="bg-white rounded-2xl p-6 border border-outline-variant custom-shadow hover-lift text-center">
                <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                  {emoji}
                </div>
                <p className="text-sm font-medium text-on-surface leading-snug">{text}</p>
              </div>
            ))}
          </div>
          {communityGroups.length === 1 ? (
            <div className="mt-12 flex flex-wrap justify-center gap-3">
              {communityGroups.map(g => {
                const typeLabel = CLASS_TYPES.find(t => t.value === g.type)?.label ?? g.type
                return (
                  <a
                    key={g.type}
                    href={g.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gradient inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-full shadow-lg hover:opacity-90 hover:scale-105 transition-all"
                  >
                    <span className="material-symbols-outlined">groups</span>
                    Gabung Grup {typeLabel}
                  </a>
                )
              })}
            </div>
          ) : communityGroups.length > 1 ? (
            <div className="mt-12 flex justify-center">
              <CommunityPickerSheet
                groups={communityGroups.map(g => ({
                  type:  g.type,
                  link:  g.link,
                  label: CLASS_TYPES.find(t => t.value === g.type)?.label ?? g.type,
                }))}
              />
            </div>
          ) : waNumber && (
            <div className="mt-12 text-center">
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo! Aku mau ikut gabung komunitas ${studio} 😊`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gradient inline-flex items-center gap-2 text-white font-bold px-10 py-4 rounded-full shadow-lg hover:opacity-90 hover:scale-105 transition-all"
              >
                <span className="material-symbols-outlined">chat</span>
                Gabung Komunitas Kami
              </a>
            </div>
          )}
        </div></ScrollReveal>
      </section>

      {/* ── TESTIMONI ────────────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section className="py-24 bg-gray-50" id="testimonials">
          <ScrollReveal><div className="max-w-container-max mx-auto px-4 md:px-10">
            <div className="text-center mb-16">
              <h2 className="font-montserrat text-3xl md:text-5xl font-bold text-on-surface mb-3">Kata Mereka</h2>
              <p className="text-on-surface-variant">Pengalaman langsung dari peserta kelas</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(testimonials as any[]).map(t => (
                <div key={t.id} className="bg-white rounded-2xl p-6 border border-outline-variant custom-shadow">
                  <span className="material-symbols-outlined text-violet-200 text-3xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
                  {typeof t.rating === 'number' && (
                    <div className="flex gap-0.5 mb-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <span
                          key={n}
                          className="material-symbols-outlined text-base"
                          style={{ fontVariationSettings: n <= t.rating ? "'FILL' 1" : "'FILL' 0", color: n <= t.rating ? '#FBBF24' : '#E5E7EB' }}
                        >
                          star
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{t.content}</p>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.photo_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&size=64&background=8B5CF6&color=fff`}
                      alt={t.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <p className="font-montserrat text-sm font-bold text-on-surface">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div></ScrollReveal>
        </section>
      )}

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="py-20 px-4 md:px-10" style={{ background: HERO_GRADIENT }}>
        <div className="max-w-container-max mx-auto flex flex-col items-center text-center">
          {/* Studio */}
          <div className="mb-10 space-y-3 max-w-md">
            <p className="font-montserrat text-2xl md:text-3xl font-bold text-on-surface">{studio}</p>
            {profile.bio && (
              <p className="text-on-surface/60 text-sm italic">{profile.bio}</p>
            )}
          </div>

          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-700 text-white px-8 py-3.5 rounded-full font-bold shadow-lg hover:scale-105 active:scale-95 transition-all mb-10"
            >
              <span className="material-symbols-outlined">chat</span>
              Hubungi via WhatsApp
            </a>
          )}

          {/* Copyright + atribusi kecil, tidak menonjol */}
          <div className="pt-10 border-t border-on-surface/10 w-full space-y-2">
            <p className="text-on-surface/40 text-sm">
              © {new Date().getFullYear()} {studio}. All rights reserved.
            </p>
            <p className="text-on-surface/25 text-xs">
              Website oleh{' '}
              <Link href="/home" className="underline hover:text-on-surface/50 transition-colors">
                FitFlow Coach
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
