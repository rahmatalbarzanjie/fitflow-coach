import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CLASS_TYPES } from '@/lib/constants'
import { ClassTypeBenefitsForm } from '@/components/classes/ClassTypeBenefitsForm'

export default async function ClassBenefitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [classesRes, benefitsRes] = await Promise.all([
    supabase.from('classes').select('type').eq('user_id', user!.id),
    supabase.from('class_type_benefits').select('type, benefits').eq('user_id', user!.id),
  ])

  const usedTypes = Array.from(new Set((classesRes.data ?? []).map((c: any) => c.type)))
  const benefitsMap = Object.fromEntries(
    ((benefitsRes.data ?? []) as any[]).map(b => [b.type, b.benefits ?? ''])
  )
  const typeLabel = Object.fromEntries(CLASS_TYPES.map(t => [t.value, t.label]))

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/classes" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Manfaat Kelas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tampil sebagai deskripsi tiap tipe kelas di landing page</p>
        </div>
      </div>

      {!usedTypes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <p className="text-sm text-gray-400">Belum ada kelas - tambah kelas dulu untuk atur manfaatnya.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {usedTypes.map(type => (
            <ClassTypeBenefitsForm
              key={type}
              userId={user!.id}
              type={type}
              label={typeLabel[type] ?? type}
              initialBenefits={benefitsMap[type] ?? ''}
            />
          ))}
        </div>
      )}
    </div>
  )
}
