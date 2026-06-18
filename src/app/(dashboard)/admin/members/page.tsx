import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { MemberStatusBadge } from '@/components/members/MemberStatusBadge'
import { InstructorFilter } from '@/components/admin/InstructorFilter'
import { formatDateShort } from '@/lib/utils'

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ instructor?: string; search?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound()

  const { instructor = '', search = '' } = await searchParams
  const supa = createServiceClient()

  const [profilesRes, membersRes] = await Promise.all([
    supa.from('profiles').select('id, name, business_name').neq('id', user.id).order('name'),
    instructor
      ? supa
          .from('members')
          .select('id, name, phone, status, created_at, user_id')
          .eq('user_id', instructor)
          .order('name')
      : supa
          .from('members')
          .select('id, name, phone, status, created_at, user_id')
          .neq('user_id', user.id)
          .order('name')
          .limit(200),
  ])

  const profiles  = (profilesRes.data ?? []) as { id: string; name: string; business_name: string | null }[]
  let   members   = (membersRes.data ?? []) as { id: string; name: string; phone: string; status: string; created_at: string; user_id: string }[]

  if (search.trim()) {
    const q = search.trim().toLowerCase()
    members = members.filter(m =>
      m.name?.toLowerCase().includes(q) || m.phone?.toLowerCase().includes(q)
    )
  }

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.business_name ?? p.name]))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Semua Member</h1>
          <p className="text-sm text-gray-400 mt-0.5">{members.length} member{!instructor ? ' (max 200)' : ''}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <InstructorFilter profiles={profiles} selected={instructor} />
        <form className="flex-1 min-w-[200px]">
          {instructor && <input type="hidden" name="instructor" value={instructor} />}
          <input
            name="search"
            defaultValue={search}
            placeholder="Cari nama atau no. HP..."
            className="w-full h-9 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </form>
      </div>

      {!members.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Belum ada member{instructor ? ' untuk instruktur ini' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">No. HP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Instruktur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Bergabung</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.phone ?? '-'}</td>
                  <td className="px-4 py-3">
                    <MemberStatusBadge status={(m.status ?? 'inactive') as any} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                    <Link href={`/admin/${m.user_id}`} className="hover:text-violet-600 transition-colors">
                      {profileMap[m.user_id] ?? '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                    {m.created_at ? formatDateShort(m.created_at) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
