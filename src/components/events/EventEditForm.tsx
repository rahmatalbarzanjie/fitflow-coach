'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { invalidateDashboardCache } from '@/lib/invalidate-dashboard'
import { eventSchema, type EventFormData } from '@/lib/validations/event'
import { Upload, X, Loader2 } from 'lucide-react'

interface Props {
  ev: {
    id: string
    title: string
    slug: string
    description: string | null
    event_date: string
    start_time: string
    end_time: string | null
    location: string | null
    google_maps_url?: string | null
    status: string
    pricing_mode?: string | null
    tier1_label?: string | null
    tier2_label?: string | null
    early_bird_price: number | string
    early_bird_quota: number | null
    ots_price: number | string
    max_capacity: number | null
    bank_name?: string | null
    bank_account_number?: string | null
    bank_account_name?: string | null
    cover_image_url?: string | null
  }
}

const inp = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-gray-50 disabled:text-gray-400'
const lbl = 'block text-sm font-medium text-gray-700'

export function EventEditForm({ ev }: Props) {
  const [saved, setSaved]           = useState(false)
  const [serverError, setErr]       = useState<string | null>(null)
  const [coverUrl, setCoverUrl]     = useState<string | null>(ev.cover_image_url ?? null)
  const [coverUploading, setCoverUploading] = useState(false)
  const supabase = createClient()

  async function handleCoverUpload(file: File) {
    setCoverUploading(true)
    const ext      = file.name.split('.').pop()
    const filePath = `${ev.id}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('event-covers')
      .upload(filePath, file, { cacheControl: '3600', upsert: true })

    if (!error && data) {
      const { data: urlData } = supabase.storage.from('event-covers').getPublicUrl(data.path)
      const url = urlData?.publicUrl ?? null
      setCoverUrl(url)
      await supabase.from('events').update({ cover_image_url: url }).eq('id', ev.id)
    }
    setCoverUploading(false)
  }

  async function removeCover() {
    setCoverUrl(null)
    await supabase.from('events').update({ cover_image_url: null }).eq('id', ev.id)
  }

  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title:               ev.title,
      slug:                ev.slug,
      description:         ev.description ?? '',
      event_date:          ev.event_date,
      start_time:          ev.start_time.substring(0, 5),
      end_time:            ev.end_time?.substring(0, 5) ?? '',
      location:            ev.location ?? '',
      google_maps_url:     ev.google_maps_url ?? '',
      status:              ev.status as EventFormData['status'],
      pricing_mode:        (ev.pricing_mode as any) ?? 'tiered',
      tier1_label:         ev.tier1_label ?? 'Early Bird',
      tier1_price:         Number(ev.early_bird_price),
      tier1_quota:         ev.early_bird_quota ?? undefined,
      tier2_label:         ev.tier2_label ?? 'Regular',
      tier2_price:         Number(ev.ots_price),
      tier2_quota:         ev.max_capacity ?? undefined,
      ots_price:           Number(ev.ots_price),
      max_capacity:        ev.max_capacity ?? undefined,
      bank_name:           ev.bank_name ?? '',
      bank_account_number: ev.bank_account_number ?? '',
      bank_account_name:   ev.bank_account_name ?? '',
    },
  })

  async function onSubmit(data: EventFormData) {
    setErr(null)
    const isTiered = data.pricing_mode === 'tiered'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('events') as any)
      .update({
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
        tier1_label:         data.tier1_label || 'Early Bird',
        tier2_label:         data.tier2_label || 'Regular',
        early_bird_price:    isTiered ? data.tier1_price : 0,
        early_bird_quota:    isTiered ? (data.tier1_quota || null) : null,
        ots_price:           isTiered ? data.tier2_price : data.ots_price,
        max_capacity:        isTiered ? (data.tier2_quota || null) : (data.max_capacity || null),
        bank_name:           data.bank_name || null,
        bank_account_number: data.bank_account_number || null,
        bank_account_name:   data.bank_account_name || null,
      })
      .eq('id', ev.id)

    if (error) {
      setErr(error.code === '23505' ? 'Slug sudah dipakai.' : error.message)
      return
    }
    invalidateDashboardCache()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{serverError}</div>
      )}

      <div className="space-y-1.5">
        <label className={lbl}>Judul Event</label>
        <input {...register('title')} className={inp} />
        {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Slug URL</label>
        <input {...register('slug')} className={inp} />
        {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className={lbl}>Tanggal</label>
          <input {...register('event_date')} type="date" className={inp} />
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>Mulai</label>
          <input {...register('start_time')} type="time" className={inp} />
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>Selesai</label>
          <input {...register('end_time')} type="time" className={inp} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Lokasi</label>
        <input {...register('location')} placeholder="Opsional" className={inp} />
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>
          Link Google Maps
          <span className="text-gray-400 font-normal ml-1 text-xs">(opsional)</span>
        </label>
        <input {...register('google_maps_url')} placeholder="https://maps.app.goo.gl/..." className={inp} />
        {errors.google_maps_url && <p className="text-xs text-red-600">{errors.google_maps_url.message}</p>}
      </div>

      {/* Harga Tier 1 */}
      <div className="p-3 bg-green-50 border border-green-100 rounded-xl space-y-2">
        <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Tier 1 (Gelombang Awal)</p>
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

      {/* Harga Tier 2 */}
      <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl space-y-2">
        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Tier 2 / OTS (Gelombang Lanjutan)</p>
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

      {/* Bank Info */}
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Info Pembayaran</p>
        <div className="space-y-1.5">
          <label className={lbl}>Nama Bank</label>
          <input {...register('bank_name')} placeholder="BCA, BRI, Mandiri, dll" className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={lbl}>Nomor Rekening</label>
            <input {...register('bank_account_number')} placeholder="1234567890" className={inp} />
          </div>
          <div className="space-y-1.5">
            <label className={lbl}>Atas Nama</label>
            <input {...register('bank_account_name')} placeholder="Nama pemilik" className={inp} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Deskripsi</label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Status</label>
        <select {...register('status')} className={inp}>
          <option value="draft">Draft (belum publik)</option>
          <option value="published">Aktif (publik, bisa daftar)</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      {/* Cover / Flyer upload */}
      <div className="space-y-1.5">
        <label className={lbl}>
          Flyer / Cover Event
          <span className="text-gray-400 font-normal ml-1 text-xs">(tampil di landing page)</span>
        </label>
        {coverUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="cover" className="w-full max-h-48 object-cover" />
            <button
              type="button"
              onClick={removeCover}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 cursor-pointer h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 bg-gray-50 hover:bg-violet-50 transition-all">
            {coverUploading ? (
              <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">Klik untuk upload flyer</span>
                <span className="text-xs text-gray-400">JPG, PNG, maks 5MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={coverUploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }}
            />
          </label>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : saved ? 'Tersimpan ✓' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  )
}
