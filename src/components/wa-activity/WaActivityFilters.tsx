'use client'

import { Search, X } from 'lucide-react'

export interface Filters {
  date_preset:  string
  date_from:    string
  date_to:      string
  direction:    string
  message_type: string
  status:       string
  contact:      string
}

const DATE_PRESETS = [
  { value: 'today', label: 'Hari Ini' },
  { value: '7d',    label: '7 Hari' },
  { value: '30d',   label: '30 Hari' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Kustom' },
]

const DIRECTIONS = [
  { value: '',         label: 'Semua Arah' },
  { value: 'outbound', label: 'Keluar' },
  { value: 'inbound',  label: 'Masuk' },
]

const MESSAGE_TYPES = [
  { value: '',             label: 'Semua Jenis' },
  { value: 'registration', label: 'Pendaftaran Kelas' },
  { value: 'event',        label: 'Pendaftaran Event' },
  { value: 'broadcast',    label: 'Broadcast' },
  { value: 'community',    label: 'Undangan Komunitas' },
  { value: 'feedback',     label: 'Permintaan Feedback' },
  { value: 'chatbot',      label: 'Chatbot' },
  { value: 'system',       label: 'Sistem' },
]

const STATUSES = [
  { value: '',       label: 'Semua Status' },
  { value: 'sent',   label: 'Terkirim' },
  { value: 'failed', label: 'Gagal' },
]

interface Props {
  filters:   Filters
  onChange:  (f: Partial<Filters>) => void
  onReset:   () => void
}

export function WaActivityFilters({ filters, onChange, onReset }: Props) {
  const hasActiveFilter =
    filters.date_preset !== '7d' ||
    filters.direction ||
    filters.message_type ||
    filters.status ||
    filters.contact

  return (
    <div className="space-y-3 mb-4">
      {/* Quick date pills */}
      <div className="flex gap-1.5 flex-wrap">
        {DATE_PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => onChange({ date_preset: p.value })}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              filters.date_preset === p.value
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range (only when custom selected) */}
      {filters.date_preset === 'custom' && (
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={filters.date_from}
            onChange={e => onChange({ date_from: e.target.value })}
            className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-700"
          />
          <span className="text-gray-400 text-xs">s/d</span>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => onChange({ date_to: e.target.value })}
            className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-700"
          />
        </div>
      )}

      {/* Row filter + search */}
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={filters.direction}
          onChange={e => onChange({ direction: e.target.value })}
          className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-700 bg-white"
        >
          {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>

        <select
          value={filters.message_type}
          onChange={e => onChange({ message_type: e.target.value })}
          className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-700 bg-white"
        >
          {MESSAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={e => onChange({ status: e.target.value })}
          className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-700 bg-white"
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Contact search */}
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama / nomor..."
            value={filters.contact}
            onChange={e => onChange({ contact: e.target.value })}
            className="w-full h-8 pl-7 pr-2 text-xs border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>

        {hasActiveFilter && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 h-8 px-2.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>
    </div>
  )
}
