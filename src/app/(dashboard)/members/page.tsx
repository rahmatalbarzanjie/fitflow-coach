import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { MembersSearch } from '@/components/members/MembersSearch'
import { timed } from '@/lib/perf'

export default async function MembersPage() {
  console.time('page:/members')
  const supabase = await createClient()
  // getSession() baca dari cookie (tanpa network call) - middleware sudah validasi sesi
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  console.time('query:/members:all')
  const { data: members, error } = await timed<any>('query:/members:members', (supabase.from('members') as any)
    .select('id, name, phone, status, last_attended_at, photo_url')
    .eq('user_id', user!.id)
    .order('name', { ascending: true }))
  console.timeEnd('query:/members:all')

  if (error) console.error('Members query error:', error)

  const all = (members ?? []) as any[]

  // Hitung counts per status untuk filter pills
  const counts = all.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1
    return acc
  }, {})

  console.timeEnd('page:/members')

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Member</h1>
          <p className="text-sm text-gray-400 mt-0.5">{all.length} member terdaftar</p>
        </div>
        <Link
          href="/members/new"
          className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </Link>
      </div>

      {/* Search + filter + list — semua client-side */}
      <MembersSearch
        members={all}
        counts={counts}
        total={all.length}
      />
    </div>
  )
}
