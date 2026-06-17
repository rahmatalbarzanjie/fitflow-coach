import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { InstructorFilter } from '@/components/admin/InstructorFilter'
import { Badge } from '@/components/ui/badge'
import { formatDateShort } from '@/lib/utils'

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'Semua Member', active: 'Member Aktif', at_risk: 'Perlu Perhatian', inactive: 'Tidak Aktif', new: 'Member Baru',
}

export default async function AdminBroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ instructor?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound()

  const { instructor = '' } = await searchParams
  const supa = createServiceClient()

  const [profilesRes, broadcastsRes] = await Promise.all([
    supa.from('profiles').select('id, name, business_name').order('name'),
    instructor
      ? supa
          .from('broadcasts')
          .select('id, title, target_audience, status, recipient_count, sent_at, created_at, user_id')
          .eq('user_id', instructor)
          .order('created_at', { ascending: false })
      : supa
          .from('broadcasts')
          .select('id, title, target_audience, status, recipient_count, sent_at, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(200),
  ])

  const profiles    = (profilesRes.data ?? []) as { id: string; name: string; business_name: string | null }[]
  const broadcasts   = (broadcastsRes.data ?? []) as any[]
  const profileMap  = Object.fromEntries(profiles.map(p => [p.id, p.business_name ?? p.name]))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Semua Broadcast</h1>
          <p className="text-sm text-gray-400 mt-0.5">{broadcasts.length} pesan{!instructor ? ' (max 200)' : ''}</p>
        </div>
      </div>

      <div className="mb-4">
        <InstructorFilter profiles={profiles} selected={instructor} />
      </div>

      {!broadcasts.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Send className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Belum ada broadcast{instructor ? ' untuk instruktur ini' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Judul</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Target</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Instruktur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map(bc => (
                <tr key={bc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{bc.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{AUDIENCE_LABEL[bc.target_audience] ?? bc.target_audience}</td>
                  <td className="px-4 py-3 text-xs">
                    <Badge color={bc.status === 'sent' ? 'green' : 'gray'}>{bc.status === 'sent' ? 'Terkirim' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                    <Link href={`/admin/${bc.user_id}`} className="hover:text-violet-600 transition-colors">
                      {profileMap[bc.user_id] ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                    {bc.status === 'sent' && bc.sent_at ? formatDateShort(bc.sent_at) : formatDateShort(bc.created_at)}
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
