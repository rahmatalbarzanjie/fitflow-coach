'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { eventSchema, type EventFormData } from '@/lib/validations/event'
import { SectionList } from '@/components/ui/SectionList'
import { EVENT_STATUS } from '@/lib/constants'
import { Upload, X, Loader2, Trash2 } from 'lucide-react'

const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'
const lbl = 'block text-sm font-medium text-gray-700 mb-1.5'

interface Props {
  ev: any
  hasRegistrations: boolean
  paymentProfiles?: { id: string; name: string }[]
}

export function EventSettingsForm({ ev, hasRegistrations, paymentProfiles = [] }: Props) {
  const router   = useRouter()
  const id       = ev.id
  const supabase = createClient()

  const [statusValue,  setStatusValue ] = useState(ev.status)
  // Deteksi pricing_mode: fallback ke 'single' jika early_bird_price = 0
  const detectedMode = (ev.pricing_mode === 'single' || Number(ev.early_bird_price) === 0)
    ? 'single' : 'tiered'
  const [pricingMode, setPricingMode] = useState<'single' | 'tiered'>(detectedMode)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusSaved,  setStatusSaved ] = useState(false)
  const [coverUrl,     setCoverUrl    ] = useState<string | null>(ev.cover_image_url ?? null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [confirmDel,   setConfirmDel  ] = useState(false)
  const [deleting,     setDeleting    ] = useState(false)
  const [serverError,  setServerError ] = useState('')

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title:               ev.title,
      slug:                ev.slug,
      description:         ev.description ?? '',
      event_date:          ev.event_date,
      start_time:          ev.start_time?.substring(0, 5) ?? '',
      end_time:            ev.end_time?.substring(0, 5) ?? '',
      location:            ev.location ?? '',
      google_maps_url:     ev.google_maps_url ?? '',
      status:              ev.status,
      pricing_mode:        ev.pricing_mode ?? 'tiered',
      tier1_label:         ev.tier1_label ?? 'Early Bird',
      tier1_price:         Number(ev.early_bird_price) || 0,
      tier1_quota:         ev.early_bird_quota ?? undefined,
      tier2_label:         ev.tier2_label ?? 'Regular',
      tier2_price:         Number(ev.ots_price) || 0,
      tier2_quota:         ev.max_capacity ?? undefined,
      ots_price:           Number(ev.ots_price) || 0,
      max_capacity:        ev.max_capacity ?? undefined,
      payment_profile_id:  ev.payment_profile_id ?? '',
    },
  })

  async function saveStatus() {
    setSavingStatus(true)
    await supabase.from('events').update({ status: statusValue }).eq('id', id)
    setSavingStatus(false)
    setStatusSaved(true)
    setTimeout(() => setStatusSaved(false), 2000)
  }

  async function handleCoverUpload(file: File) {
    setCoverUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${id}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('event-covers').upload(path, file, { cacheControl: '3600', upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('event-covers').getPublicUrl(data.path)
      const url = urlData?.publicUrl ?? null
      setCoverUrl(url)
      await supabase.from('events').update({ cover_image_url: url }).eq('id', id)
    }
    setCoverUploading(false)
  }

  async function removeCover() {
    setCoverUrl(null)
    await supabase.from('events').update({ cover_image_url: null }).eq('id', id)
  }

  async function onSubmit(data: EventFormData) {
    setServerError('')
    const isTiered = pricingMode === 'tiered'
    const { error } = await (supabase.from('events') as any).update({
      title:               data.title,
      slug:                data.slug,
      description:         data.description || null,
      event_date:          data.event_date,
      start_time:          data.start_time,
      end_time:            data.end_time || null,
      location:            data.location || null,
      google_maps_url:     data.google_maps_url || null,
      status:              statusValue,
      pricing_mode:        pricingMode,
      // Single: simpan harga di ots_price, kosongkan early bird
      // Tiered: simpan tier1 → early_bird, tier2 → ots
      tier1_label:         isTiered ? (data.tier1_label || 'Early Bird') : null,
      tier2_label:         isTiered ? (data.tier2_label || 'Regular') : null,
      early_bird_price:    isTiered ? data.tier1_price : 0,
      early_bird_quota:    isTiered ? (data.tier1_quota || null) : null,
      ots_price:           isTiered ? data.tier2_price : data.ots_price,
      max_capacity:        isTiered ? (data.tier2_quota || null) : (data.max_capacity || null),
      payment_profile_id:  data.payment_profile_id || null,
    }).eq('id', id)

    if (error) {
      setServerError(error.code === '23505' ? 'Slug sudah dipakai.' : error.message)
      return
    }
    router.push(`/events/${id}`)
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('events').delete().eq('id', id)
    router.push('/events')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* STATUS — quick save */}
      <SectionList label="Status Event" footer="Ubah status untuk mempublikasikan atau menutup pendaftaran.">
        <div className="px-4 py-4 space-y-3">
          <select
            value={statusValue}
            onChange={e => { setStatusValue(e.target.value); setStatusSaved(false) }}
            className={inp}
          >
            {Object.entries(EVENT_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <button onClick={saveStatus} disabled={savingStatus}
            className="w-full h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {savingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
            {statusSaved ? 'Status Tersimpan ✓' : savingStatus ? 'Menyimpan...' : 'Simpan Status'}
          </button>
        </div>
      </SectionList>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{serverError}</div>
        )}

        {/* INFORMASI EVENT */}
        <SectionList label="Informasi Event">
          <div className="px-4 py-4 space-y-4">
            <div><label className={lbl}>Judul Event</label><input {...register('title')} className={inp} /></div>
            <div><label className={lbl}>Tanggal</label><input {...register('event_date')} type="date" className={inp} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Jam Mulai</label><input {...register('start_time')} type="time" className={inp} /></div>
              <div><label className={lbl}>Jam Selesai</label><input {...register('end_time')} type="time" className={inp} /></div>
            </div>
            <div><label className={lbl}>Lokasi</label><input {...register('location')} placeholder="Opsional" className={inp} /></div>
            <div>
              <label className={lbl}>Link Google Maps <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
              <input {...register('google_maps_url')} placeholder="https://maps.app.goo.gl/..." className={inp} />
            </div>
            <div>
              <label className={lbl}>Deskripsi</label>
              <textarea {...register('description')} rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className={lbl}>Slug URL</label>
              <input {...register('slug')} className={inp} />
              <p className="text-xs text-gray-400 mt-1">Dipakai untuk link pendaftaran publik</p>
            </div>
            {/* Cover */}
            <div>
              <label className={lbl}>Flyer atau foto event</label>
              <p className="text-xs text-gray-400 mb-1.5">
                Tampil di landing page. Bisa berupa flyer promosi atau foto venue/event sebelumnya.
              </p>
              {coverUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="cover" className="w-full max-h-48 object-cover" />
                  <button type="button" onClick={removeCover}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 bg-gray-50 hover:bg-violet-50 transition-all">
                  {coverUploading ? <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                    : <><Upload className="w-5 h-5 text-gray-400" /><span className="text-sm text-gray-500">Upload flyer</span></>}
                  <input type="file" accept="image/*" className="hidden" disabled={coverUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }} />
                </label>
              )}
            </div>
          </div>
        </SectionList>

        {/* HARGA & PEMBAYARAN */}
        <SectionList label="Harga & Pembayaran">
          <div className="px-4 py-4 space-y-4">

            {/* Toggle pricing mode — hanya bisa diubah jika belum ada pendaftar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={lbl + ' mb-0'}>Mode Harga</label>
                {hasRegistrations && (
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                    🔒 Terkunci — sudah ada pendaftar
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {(['single', 'tiered'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    disabled={hasRegistrations}
                    onClick={() => !hasRegistrations && setPricingMode(mode)}
                    className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-colors border ${
                      pricingMode === mode
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {mode === 'single' ? '💰 Harga Tunggal' : '🎯 Harga Bertingkat'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {pricingMode === 'single'
                  ? 'Semua peserta membayar harga yang sama.'
                  : 'Early Bird lebih murah, Regular untuk sisa kuota.'}
              </p>
            </div>

            {/* SINGLE PRICE */}
            {pricingMode === 'single' && (
              <div>
                <label className={lbl}>Harga Tiket (Rp)</label>
                <input
                  {...register('ots_price')}
                  type="number" min="0"
                  disabled={hasRegistrations}
                  className={inp + (hasRegistrations ? ' opacity-60' : '')}
                />
              </div>
            )}

            {/* TIERED PRICE */}
            {pricingMode === 'tiered' && (
              <>
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Tier 1 — Gelombang Awal</p>
                  <div>
                    <label className={lbl}>Label</label>
                    <input {...register('tier1_label')} placeholder="Early Bird" disabled={hasRegistrations} className={inp + (hasRegistrations ? ' opacity-60' : '')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Harga (Rp)</label>
                      <input {...register('tier1_price')} type="number" min="0" disabled={hasRegistrations} className={inp + (hasRegistrations ? ' opacity-60' : '')} />
                    </div>
                    <div>
                      <label className={lbl}>Kuota</label>
                      <input {...register('tier1_quota')} type="number" min="1" placeholder="Tak terbatas" disabled={hasRegistrations} className={inp + (hasRegistrations ? ' opacity-60' : '')} />
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Tier 2 — Gelombang Lanjutan</p>
                  <div>
                    <label className={lbl}>Label</label>
                    <input {...register('tier2_label')} placeholder="Regular" disabled={hasRegistrations} className={inp + (hasRegistrations ? ' opacity-60' : '')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Harga (Rp)</label>
                      <input {...register('tier2_price')} type="number" min="0" disabled={hasRegistrations} className={inp + (hasRegistrations ? ' opacity-60' : '')} />
                    </div>
                    <div>
                      <label className={lbl}>Kuota</label>
                      <input {...register('tier2_quota')} type="number" min="1" placeholder="Tak terbatas" disabled={hasRegistrations} className={inp + (hasRegistrations ? ' opacity-60' : '')} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Payment Profile */}
            <div className="space-y-1.5 pt-1">
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
              {paymentProfiles.length === 0 && (
                <p className="text-xs text-gray-400">
                  Belum ada Payment Profile yang siap (perlu minimal 1 metode pembayaran). Atur di menu Payment Profiles.
                </p>
              )}
            </div>
          </div>
        </SectionList>

        {/* TOMBOL SIMPAN GLOBAL */}
        <button type="submit" disabled={isSubmitting}
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>

      {/* ZONA BERBAHAYA */}
      <SectionList label="Zona Berbahaya" className="mt-4">
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 mb-4">Menghapus event akan menghapus semua data pendaftaran secara permanen.</p>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              className="flex items-center gap-2 h-10 px-4 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors">
              <Trash2 className="w-4 h-4" /> Hapus Event
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-600">Yakin ingin menghapus event ini?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 h-10 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium">Batal</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionList>
    </div>
  )
}
