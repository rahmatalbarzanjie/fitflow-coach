'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Profile {
  id: string
  name: string
  business_name: string | null
}

interface Props {
  profiles: Profile[]
  selected: string
}

export function InstructorFilter({ profiles, selected }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('instructor', e.target.value)
    } else {
      params.delete('instructor')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={selected}
      onChange={handleChange}
      className="h-9 px-3 pr-8 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white appearance-none"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}
    >
      <option value="">Semua Instruktur</option>
      {profiles.map(p => (
        <option key={p.id} value={p.id}>
          {p.business_name ?? p.name}
        </option>
      ))}
    </select>
  )
}
