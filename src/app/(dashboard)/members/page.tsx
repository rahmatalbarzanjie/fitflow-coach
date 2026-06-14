import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { UserPlus, Users } from 'lucide-react'
import { MembersSearch } from '@/components/members/MembersSearch'
import { MemberStatusBadge } from '@/components/members/MemberStatusBadge'
import { MemberAvatar } from '@/components/members/MemberPhotoUpload'
import { timeAgo } from '@/lib/utils'

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const { search = '', status = 'all' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch filtered members from view
  let query = supabase
    .from('member_summary')
    .select('*')
    .eq('user_id', user!.id)
    .order('name', { ascending: true })

  if (status !== 'all') query = query.eq('status', status as any)
  if (search.trim())    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data: members } = await query

  // Counts per status for filter tabs
  const { data: allStatuses } = await supabase
    .from('members')
    .select('status')
    .eq('user_id', user!.id)

  const counts = (allStatuses ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1
    return acc
  }, {})
  const total = allStatuses?.length ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Members</h1>
        <Link
          href="/members/new"
          className="inline-flex items-center gap-2 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Tambah Member
        </Link>
      </div>

      <MembersSearch
        currentSearch={search}
        currentStatus={status}
        counts={counts}
        total={total}
      />

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-4">
        {!members?.length ? (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {search || status !== 'all' ? 'Tidak ada member yang cocok' : 'Belum ada member'}
            </p>
            {!search && status === 'all' && (
              <Link href="/members/new" className="mt-3 inline-block text-sm text-violet-600 hover:underline">
                Tambah member pertama
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3">Nama</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Terakhir Hadir</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Bulan Ini</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(members as any[]).map(m => (
                <tr key={m.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-3.5">
                    <Link href={`/members/${m.id}`} className="flex items-center gap-3">
                      <MemberAvatar photoUrl={m.photo_url} name={m.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-violet-700 transition-colors">
                          {m.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{m.phone}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <MemberStatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-gray-500">
                      {m.last_attended_at ? timeAgo(m.last_attended_at) : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {m.attended_this_month ?? 0}x
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="text-sm text-gray-500">{m.total_attended ?? 0}x</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {members && members.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          Menampilkan {members.length} dari {total} member
        </p>
      )}
    </div>
  )
}
