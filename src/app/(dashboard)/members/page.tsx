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
        <h1 className="text-xl font-semibold text-gray-900">Member</h1>
        <Link
          href="/members/new"
          className="inline-flex items-center gap-2 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Tambah
        </Link>
      </div>

      <MembersSearch
        currentSearch={search}
        currentStatus={status}
        counts={counts}
        total={total}
      />

      {/* Card list */}
      <div className="mt-4 space-y-2">
        {!members?.length ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
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
          (members as any[]).map(m => (
            <Link
              key={m.id}
              href={`/members/${m.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-violet-100 hover:shadow-sm transition-all"
            >
              <MemberAvatar photoUrl={m.photo_url} name={m.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                  <MemberStatusBadge status={m.status} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{m.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">
                  {m.last_attended_at ? timeAgo(m.last_attended_at) : 'Belum pernah'}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>

      {members && members.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {members.length} dari {total} member
        </p>
      )}
    </div>
  )
}
