'use client'

import { useState } from 'react'
import { Eye, EyeOff, Check, Loader2 } from 'lucide-react'

interface Field {
  key: string
  label: string
  desc: string
  type: 'text' | 'password' | 'url'
}

interface Props {
  fields: Field[]
  initialValues: Record<string, string>
}

export function ConfigForm({ fields, initialValues }: Props) {
  const [values,  setValues ] = useState(initialValues)
  const [shown,   setShown  ] = useState<Set<string>>(new Set())
  const [saving,  setSaving ] = useState<string | null>(null)
  const [saved,   setSaved  ] = useState<string | null>(null)
  const [errors,  setErrors ] = useState<Record<string, string>>({})

  async function save(key: string) {
    setSaving(key)
    setErrors(prev => ({ ...prev, [key]: '' }))
    try {
      const res = await fetch('/api/admin/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, value: values[key] ?? '' }),
      })
      const d = await res.json()
      if (!res.ok) {
        setErrors(prev => ({ ...prev, [key]: d.error ?? 'Gagal simpan' }))
      } else {
        setSaved(key)
        setTimeout(() => setSaved(null), 2000)
      }
    } finally {
      setSaving(null)
    }
  }

  function toggleShow(key: string) {
    setShown(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  return (
    <div className="space-y-6">
      {fields.map(f => {
        const isPass = f.type === 'password'
        const showVal = shown.has(f.key)
        const isSaving = saving === f.key
        const isSaved  = saved  === f.key

        return (
          <div key={f.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
            <p className="text-xs text-gray-400 mb-2">{f.desc}</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={isPass && !showVal ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save(f.key)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  style={{ paddingRight: isPass ? '2.25rem' : undefined }}
                  placeholder={f.type === 'url' ? 'https://...' : isPass ? '••••••••' : ''}
                />
                {isPass && (
                  <button
                    type="button"
                    onClick={() => toggleShow(f.key)}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showVal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <button
                onClick={() => save(f.key)}
                disabled={isSaving}
                className="h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0 min-w-[4.5rem] justify-center"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                 : isSaved  ? <><Check className="w-3.5 h-3.5" /> Tersimpan</>
                 : 'Simpan'}
              </button>
            </div>
            {errors[f.key] && (
              <p className="text-xs text-red-500 mt-1">{errors[f.key]}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
