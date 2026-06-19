'use client'

import { useState, useMemo } from 'react'
import { Search, Users2 } from 'lucide-react'
import { ConvertToMemberButton } from '@/components/community/ConvertToMemberButton'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { formatDateShort } from '@/lib/utils'

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  poundfit: { label: 'Poundfit', color: 'bg-red-100 text-red-600' },
  barre:    { label: 'Barre',    color: 'bg-pink-100 text-pink-600' },
  zumba:    { label: 'Zumba',    color: 'bg-yellow-100 text-yellow-700' },
  yoga:     { label: 'Yoga',     color: 'bg-green-100 text-green-700' },
  pilates:  { label: 'Pilates',  color: 'bg-blue-100 text-blue-600' },
  aerobic:  { label: 'Aerobic',  color: 'bg-orange-100 text-orange-600' },
  other:    { label: 'Lainnya',  color: 'bg-gray-100 text-gray-600' },
}

const SOURCE_LABEL: Record<string, string> = {
  manual:   'Manual',
  wa_group: 'Grup WA',
  walkin:   'Walk-in',
  booking:  'Booking',
}

interface Contact {
  id:                  string
  name:                string | null
  phone:               string | null
  class_type:          string | null
  source:              string
  created_at:          string
  converted_member_id: string | null
}

interface TypeOption {
  value: string
  label: string
}

interface Props {
  contacts:       Contact[]
  typeFilter:     string
  availableTypes: TypeOption[]
  typeLabel:      Record<string, string>
  userId:         string
}

export function CommunityTable({
  contacts,
  typeFilter,
  availableTypes,
  typeLabel,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return contacts
    return contacts.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    )
  }, [contacts, search])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

      {/* ── Toolbar: search + filter ── */}
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor HP..."
            className="w-full pl-9 pr-4 h-9 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/community"
            className={`h-8 px-4 rounded-full text-xs font-medium transition-colors flex items-center ${
              !typeFilter
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semua
          </a>
          {availableTypes.map(t => (
            <a
              key={t.value}
              href={`/community?type=${t.value}`}
              className={`h-8 px-4 rounded-full text-xs font-medium transition-colors flex items-center ${
                typeFilter === t.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Info row ── */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-xs text-gray-400">
          Menampilkan <span className="font-semibold text-gray-600">{filtered.length}</span> dari{' '}
          <span className="font-semibold text-gray-600">{contacts.length}</span> kontak
          {typeFilter && ` · Filter: ${typeLabel[typeFilter] ?? typeFilter}`}
          {search && ` · Pencarian: "${search}"`}
        </p>
      </div>

      {/* ── Tabel ── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Users2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {search ? `Tidak ada kontak dengan kata "${search}"` : 'Belum ada kontak komunitas'}
          </p>
          <p className="text-xs text-gray-300 mt-1">
            Tambah manual atau otomatis terisi dari walk-in & grup WA
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">No. HP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kelas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Sumber</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Bergabung</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c, i) => {
                const badge = c.class_type ? TYPE_BADGE[c.class_type] : null
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    {/* No */}
                    <td className="px-4 py-3 text-xs text-gray-300">{i + 1}</td>

                    {/* Nama */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-violet-600 font-semibold text-xs">
                            {(c.name ?? '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800 text-sm">
                          {c.name ?? '(tanpa nama)'}
                        </span>
                        {c.converted_member_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">
                            Member
                          </span>
                        )}
                      </div>
                    </td>

                    {/* No HP */}
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {c.phone ?? '-'}
                    </td>

                    {/* Kelas */}
                    <td className="px-4 py-3">
                      {badge ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>

                    {/* Sumber */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {SOURCE_LABEL[c.source] ?? c.source}
                      </span>
                    </td>

                    {/* Tanggal */}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {formatDateShort(c.created_at)}
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {!c.converted_member_id && (
                          <ConvertToMemberButton
                            contactId={c.id}
                            initialName={c.name ?? ''}
                            initialPhone={c.phone ?? ''}
                          />
                        )}
                        <DeleteButton
                          table="community_contacts"
                          id={c.id}
                          redirectTo="/community"
                          confirmText="Hapus kontak ini?"
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
