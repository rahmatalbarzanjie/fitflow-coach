import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Settings } from 'lucide-react'
import { CLASS_TYPES } from '@/lib/constants'
import { CommunityList } from '@/components/community/CommunityList'
import { timed } from '@/lib/perf'

export default async function CommunityPage() {
  console.time('page:/community')
  const supabase = await createClient()
  // getSession() baca dari cookie (tanpa network call) - middleware sudah validasi sesi
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  console.time('query:/community:all')
  const [classesRes, contactsRes] = await Promise.all([
    timed('query:/community:classes', supabase.from('classes').select('type').eq('user_id', user!.id)),
    timed('query:/community:contacts', supabase
      .from('community_contacts')
      .select('id, name, phone, class_type, source, created_at, converted_member_id')
      .eq('user_id', user!.id)
      .order('name', { ascending: true })),
  ])
  console.timeEnd('query:/community:all')

  const contacts = (contactsRes.data ?? []) as any[]
  const usedTypes = Array.from(new Set((classesRes.data ?? []).map((c: any) => c.type)))
  const availableTypes = CLASS_TYPES.filter(t => usedTypes.includes(t.value))

  const totalMember = contacts.filter(c => c.converted_member_id).length

  console.timeEnd('page:/community')

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Komunitas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {contacts.length} kontak · {totalMember} sudah jadi member
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/community/setup"
            className="w-9 h-9 flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
            title="Pengaturan Komunitas"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <Link
            href="/community/new"
            className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </Link>
        </div>
      </div>

      {/* List + search + filter — client-side */}
      <CommunityList
        contacts={contacts}
        availableTypes={availableTypes}
        total={contacts.length}
      />
    </div>
  )
}
