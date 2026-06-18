import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Users2 } from 'lucide-react'
import { InstructorFilter } from '@/components/admin/InstructorFilter'

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ instructor?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound()

  const { instructor = '' } = await searchParams
  const supa = createServiceClient()

  const [profilesRes, contactsRes] = await Promise.all([
    supa.from('profiles').select('id, name, business_name').neq('id', user.id).order('name'),
    instructor
      ? supa
          .from('community_contacts')
          .select('id, name, phone, notes, created_at, user_id, converted_member_id, classes(name)')
          .eq('user_id', instructor)
          .order('created_at', { ascending: false })
      : supa
          .from('community_contacts')
          .select('id, name, phone, notes, created_at, user_id, converted_member_id, classes(name)')
          .neq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
  ])

  const profiles = (profilesRes.data ?? []) as { id: string; name: string; business_name: string | null }[]
  const contacts  = (contactsRes.data ?? []) as any[]
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.business_name ?? p.name]))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Semua Komunitas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contacts.length} kontak{!instructor ? ' (max 200)' : ''}</p>
        </div>
      </div>

      <div className="mb-4">
        <InstructorFilter profiles={profiles} selected={instructor} />
      </div>

      {!contacts.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Users2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Belum ada kontak komunitas{instructor ? ' untuk instruktur ini' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">No. HP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Kelas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Instruktur</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name ?? '(tanpa nama)'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{(c.classes as any)?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.converted_member_id
                      ? <span className="text-green-600 font-medium">✓ Jadi Member</span>
                      : <span className="text-gray-400">Komunitas</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                    <Link href={`/admin/${c.user_id}`} className="hover:text-violet-600 transition-colors">
                      {profileMap[c.user_id] ?? '-'}
                    </Link>
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
