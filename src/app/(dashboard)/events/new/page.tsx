'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateDashboardCache } from '@/lib/invalidate-dashboard'
import { eventSchema, type EventFormData, toSlug } from '@/lib/validations/event'
import { PageHeader } from '@/components/ui/PageHeader'
import { Time24Input } from '@/components/ui/Time24Input'
import { getEligiblePaymentProfiles } from '@/lib/paymentProfiles'

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'
const lbl = 'block text-sm font-medium text-gray-700'
const sectionTitle = 'text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 pt-2'

export default function NewEventPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [slugEdited, setSlugEdited]   = useState(false)
  const [coverFile, setCoverFile]     = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [paymentProfiles, setPaymentProfiles] = useState<{ id: string; name: string }[]>([])
  const [paymentProfilesLoaded, setPaymentProfilesLoaded] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      getEligiblePaymentProfiles(supabase, user.id).then(profiles => {
        setPaymentProfiles(profiles)
        setPaymentProfilesLoaded(true)
      })
    })
  }, [supabase])

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      pricing_mode: 'tiered',
      tier1_label:  'Early Bird',
      tier1_price:  0,
      tier2_label:  'Regular',
      tier2_price:  0,
      ots_price:    0,
      status:       'draft',
    },
  })
  const { register, handleSubmit, setValue, control, watch, formState: { errors, isSubmitting } } = form
  const title       = useWatch({ control, name: 'title' })
  const pricingMode = useWatch({ control, name: 'pricing_mode' })

  useEffect(() => {
    if (!slugEdited && title) setValue('slug', toSlug(title))
  }, [title, slugEdited, setValue])

  async function uploadCover(eventId: string, file: File) {
    const ext  = file.name.split('.').pop()
    const path = `${eventId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('event-covers')
      .upload(path, file, { cacheControl: '3600', upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('event-covers').getPublicUrl(data.path)
      const url = urlData?.publicUrl ?? null
      if (url) await supabase.from('events').update({ cover_image_url: url }).eq('id', eventId)
    }
  }

  async function onSubmit(data: EventFormData) {
    setServerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // For tiered mode: tier1 → early_bird, tier2 → ots
    // For single mode: ots_price + max_capacity
    const isTimered = data.pricing_mode === 'tiered'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ev, error } = await (supabase.from('events') as any)
      .insert({
        user_id:             user.id,
        title:               data.title,
        slug:                data.slug,
        description:         data.description || null,
        event_date:          data.event_date,
        start_time:          data.start_time,
        end_time:            data.end_time || null,
        location:            data.location || null,
        google_maps_url:     data.google_maps_url || null,
        status:              data.status,
        pricing_mode:        data.pricing_mode,
        // tiered
        tier1_label:         data.tier1_label || 'Early Bird',
        tier2_label:         data.tier2_label || 'Regular',
        early_bird_price:    isTimered ? data.tier1_price  : 0,
        early_bird_quota:    isTimered ? (data.tier1_quota || null) : null,
        ots_price:           isTimered ? data.tier2_price  : data.ots_price,
        max_capacity:        isTimered ? (data.tier2_quota || null) : (data.max_capacity || null),
        payment_profile_id:  data.payment_profile_id || null,
      })
      .select('id')
      .single()

    if (error) {
      setServerError(error.code === '23505' ? 'Slug sudah dipakai. Ubah slug menjadi unik.' : error.message)
      return
    }

    if (coverFile) await uploadCover(ev.id, coverFile)

    invalidateDashboardCache()
    router.push('/events')
    router.refresh()
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref="/events" title="Buat Event" />

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {serverError}
            </div>
          )}

          {/* ── Info Dasar ── */}
          <p className={sectionTitle}>Info Event</p>

          <div className="space-y-1.5">
            <label className={lbl}>Judul Event <span className="text-red-500">*</span></label>
            <input {...register('title')} autoFocus placeholder="Contoh: Workshop Zumba Spesial HUT RI" className={inp} />
            {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className={lbl}>Slug URL <span className="text-red-500">*</span></label>
            <input
              {...register('slug')}
              placeholder="workshop-zumba-hut-ri"
              className={inp}
              onChange={e => { setSlugEdited(true); setValue('slug', e.target.value) }}
            />
            {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
            <p className="text-xs text-gray-400">URL: /{'{slug-instruktur}'}/daftar/{watch('slug') || 'slug-event'}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 md:col-span-1 space-y-1.5">
              <label className={lbl}>Tanggal <span className="text-red-500">*</span></label>
              <input {...register('event_date')} type="date" className={inp} />
              {errors.event_date && <p className="text-xs text-red-600">{errors.event_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Mulai <span className="text-red-500">*</span></label>
              <Time24Input {...register('start_time')} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Selesai</label>
              <Time24Input {...register('end_time')} className={inp} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={lbl}>Lokasi</label>
            <input {...register('location')} placeholder="Contoh: Studio A, GOR Mandiri" className={inp} />
          </div>

          <div className="space-y-1.5">
            <label className={lbl}>
              Link Google Maps
              <span className="text-gray-400 font-normal ml-1 text-xs">(opsional)</span>
            </label>
            <input {...register('google_maps_url')} placeholder="https://maps.app.goo.gl/..." className={inp} />
            {errors.google_maps_url && <p className="text-xs text-red-600">{errors.google_maps_url.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className={lbl}>
              Deskripsi / Info Penting
              <span className="text-gray-400 font-normal ml-1 text-xs">(tampil setelah peserta daftar)</span>
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Contoh: Bawa matras, handuk, dan botol minum sendiri. Pakai pakaian olahraga yang nyaman."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* ── Harga ── */}
          <p className={sectionTitle}>Harga Tiket</p>

          {/* Toggle Mode */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {pricingMode === 'tiered' ? 'Harga Bertingkat' : 'Harga Tunggal'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {pricingMode === 'tiered'
                  ? 'Early Bird → Regular otomatis saat kuota habis'
                  : 'Satu harga untuk semua peserta'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setValue('pricing_mode', pricingMode === 'tiered' ? 'single' : 'tiered')}
              className="flex items-center gap-1.5 text-sm text-violet-600 font-medium"
            >
              {pricingMode === 'tiered'
                ? <ToggleRight className="w-8 h-8 text-violet-500" />
                : <ToggleLeft className="w-8 h-8 text-gray-400" />}
            </button>
          </div>

          {pricingMode === 'tiered' ? (
            <div className="space-y-3">
              {/* Tier 1 */}
              <div className="p-4 bg-green-50 border border-green-100 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Tier 1 (Awal)</p>
                <div className="space-y-1.5">
                  <label className={lbl}>Label</label>
                  <input {...register('tier1_label')} placeholder="Early Bird" className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={lbl}>Harga (Rp)</label>
                    <input {...register('tier1_price')} type="number" min="0" className={inp} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={lbl}>Kuota</label>
                    <input {...register('tier1_quota')} type="number" min="1" placeholder="Tak terbatas" className={inp} />
                  </div>
                </div>
              </div>

              {/* Tier 2 */}
              <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Tier 2 (Lanjutan)</p>
                <div className="space-y-1.5">
                  <label className={lbl}>Label</label>
                  <input {...register('tier2_label')} placeholder="Regular" className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={lbl}>Harga (Rp)</label>
                    <input {...register('tier2_price')} type="number" min="0" className={inp} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={lbl}>Kuota</label>
                    <input {...register('tier2_quota')} type="number" min="1" placeholder="Tak terbatas" className={inp} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Kuota Tier 1 habis → otomatis tampil harga Tier 2. Semua kuota habis → pendaftaran tutup.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={lbl}>Harga (Rp)</label>
                <input {...register('ots_price')} type="number" min="0" placeholder="0 = gratis" className={inp} />
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Kapasitas Total</label>
                <input {...register('max_capacity')} type="number" min="1" placeholder="Tak terbatas" className={inp} />
              </div>
            </div>
          )}

          {/* ── Pembayaran ── */}
          <p className={sectionTitle}>Info Pembayaran</p>

          <div className="space-y-1.5">
            <label className={lbl}>
              Payment Profile
              <span className="text-gray-400 font-normal ml-1 text-xs">(tujuan pembayaran)</span>
            </label>
            <select {...register('payment_profile_id')} className={inp}>
              <option value="">Belum diatur</option>
              {paymentProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {paymentProfilesLoaded && paymentProfiles.length === 0 && (
              <p className="text-xs text-gray-400">
                Belum ada Payment Profile yang siap (perlu minimal 1 metode pembayaran). Atur di menu Payment Profiles.
              </p>
            )}
          </div>

          {/* ── Flyer ── */}
          <p className={sectionTitle}>Flyer Event</p>

          {coverPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverPreview} alt="flyer preview" className="w-full max-h-48 object-cover" />
              <button
                type="button"
                onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                Preview - akan diupload saat simpan
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 cursor-pointer h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 bg-gray-50 hover:bg-violet-50 transition-all">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Upload flyer event</span>
              <span className="text-xs text-gray-400">JPG, PNG, maks 5MB · Opsional</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setCoverFile(f)
                  setCoverPreview(URL.createObjectURL(f))
                }}
              />
            </label>
          )}

          {/* ── Status + Submit ── */}
          <p className={sectionTitle}>Status Publikasi</p>

          <div className="space-y-1.5">
            <select {...register('status')} className={inp}>
              <option value="draft">Draft (belum publik)</option>
              <option value="published">Aktif (publik, bisa daftar)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/events" className="flex-1 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Batal
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
