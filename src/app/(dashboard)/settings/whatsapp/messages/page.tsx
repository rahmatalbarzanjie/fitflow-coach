'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { WaActivityStats } from '@/components/wa-activity/WaActivityStats'
import { WaActivityFilters, type Filters } from '@/components/wa-activity/WaActivityFilters'
import { WaActivityList } from '@/components/wa-activity/WaActivityList'
import { WaActivityDetail } from '@/components/wa-activity/WaActivityDetail'
import { WaQueueHealth } from '@/components/wa-activity/WaQueueHealth'
import { Download, Trash2, AlertTriangle } from 'lucide-react'

const DEFAULT_FILTERS: Filters = {
  date_preset:  '7d',
  date_from:    '',
  date_to:      '',
  direction:    '',
  message_type: '',
  status:       '',
  contact:      '',
}

function buildQuery(f: Filters, page: number, pageSize: number): string {
  const p = new URLSearchParams()
  if (f.date_preset && f.date_preset !== 'custom') p.set('date_preset', f.date_preset)
  if (f.date_preset === 'custom' && f.date_from) p.set('date_from', f.date_from)
  if (f.date_preset === 'custom' && f.date_to)   p.set('date_to',   f.date_to)
  if (f.direction)    p.set('direction',    f.direction)
  if (f.message_type) p.set('message_type', f.message_type)
  if (f.status)       p.set('status',       f.status)
  if (f.contact)      p.set('contact',      f.contact)
  p.set('page',      String(page))
  p.set('page_size', String(pageSize))
  return p.toString()
}

export default function WaMessagesPage() {
  const [filters,   setFilters  ] = useState<Filters>(DEFAULT_FILTERS)
  const [rows,      setRows     ] = useState<Record<string, any>[]>([])
  const [total,     setTotal    ] = useState(0)
  const [page,      setPage     ] = useState(1)
  const [loading,   setLoading  ] = useState(true)
  const [selected,  setSelected ] = useState<Record<string, any> | null>(null)
  const [deleting,  setDeleting ] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, inbound: 0, outbound: 0, with_url: 0 })

  const PAGE_SIZE = 50

  const load = useCallback(async (f: Filters, p: number) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/wa/activity?${buildQuery(f, p, PAGE_SIZE)}`)
      const data = await res.json()
      if (res.ok) {
        setRows(data.data ?? [])
        setTotal(data.total ?? 0)

        // Hitung stats dari data yang dikembalikan + dari server untuk akurasi
        // (stats dihitung dari semua data, bukan hanya halaman saat ini)
        const all = data.data as Record<string, any>[]
        setStats({
          total:    data.total,
          sent:     all.filter(r => r.success).length,
          failed:   all.filter(r => !r.success).length,
          inbound:  all.filter(r => r.direction === 'inbound').length,
          outbound: all.filter(r => r.direction === 'outbound').length,
          with_url: all.filter(r => r.contains_url).length,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters, page)
  }, [filters, page, load])

  function handleFilterChange(partial: Partial<Filters>) {
    setFilters(prev => ({ ...prev, ...partial }))
    setPage(1)
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  async function handleExport() {
    const q = buildQuery(filters, 1, 10_000)
    window.location.href = `/api/wa/activity/export?${q}`
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    setDeleteConfirm(false)
    try {
      const body: Record<string, string> = {}
      if (filters.date_preset && filters.date_preset !== 'custom') body.date_preset = filters.date_preset
      if (filters.date_preset === 'custom' && filters.date_from) body.date_from = filters.date_from
      if (filters.date_preset === 'custom' && filters.date_to)   body.date_to   = filters.date_to
      if (filters.direction)    body.direction    = filters.direction
      if (filters.message_type) body.message_type = filters.message_type
      if (filters.status)       body.status       = filters.status
      if (filters.contact)      body.contact      = filters.contact

      await fetch('/api/wa/activity/delete', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      await load(filters, 1)
      setPage(1)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        title="Riwayat Pesan WhatsApp"
        subtitle="Semua pesan masuk dan keluar melalui sistem FuelOS"
        backHref="/settings/whatsapp"
        action={
          <div className="flex gap-1.5">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 h-8 px-3 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Unduh CSV
            </button>
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-red-500 flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Hapus data ini?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-8 px-2.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Ya
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="h-8 px-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 h-8 px-3 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Filter Ini
              </button>
            )}
          </div>
        }
      />

      <WaActivityStats stats={stats} />

      <WaActivityFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <WaActivityList
          rows={rows}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          loading={loading}
          onSelect={setSelected}
          onPage={setPage}
        />
      </div>

      <WaQueueHealth />

      {selected && (
        <WaActivityDetail
          row={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
