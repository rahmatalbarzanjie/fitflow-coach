import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Settings } from 'lucide-react'
import { ConfigForm } from '@/components/admin/ConfigForm'

const CONFIG_FIELDS = [
  {
    key:   'fonnte_token',
    label: 'Fonnte Token',
    desc:  'Token API Fonnte untuk mengirim WhatsApp. Dapatkan di fonnte.com',
    type:  'password' as const,
  },
  {
    key:   'admin_wa',
    label: 'WhatsApp Admin',
    desc:  'Nomor WA admin untuk support (format: 628xxx tanpa tanda +)',
    type:  'text' as const,
  },
  {
    key:   'app_name',
    label: 'Nama Aplikasi',
    desc:  'Nama yang ditampilkan ke pengguna di seluruh aplikasi',
    type:  'text' as const,
  },
  {
    key:   'app_url',
    label: 'URL Aplikasi',
    desc:  'URL publik aplikasi tanpa trailing slash (misal: https://fitflow.id)',
    type:  'url' as const,
  },
]

export default async function AdminConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound()

  const supa = createServiceClient()
  const { data: rows } = await supa.from('system_config').select('key, value')
  const config = Object.fromEntries(
    ((rows ?? []) as { key: string; value: string }[]).map(r => [r.key, r.value ?? ''])
  )

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-violet-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Konfigurasi Sistem</h1>
          <p className="text-sm text-gray-400">Setting aplikasi tersimpan di database — tidak perlu edit .env</p>
        </div>
      </div>

      <Card className="mb-4">
        <ConfigForm fields={CONFIG_FIELDS} initialValues={config} />
      </Card>

      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <p className="text-xs font-semibold text-amber-700 mb-2">Variabel yang tetap harus di .env.local</p>
        <ul className="space-y-1">
          {[
            ['ADMIN_EMAIL', 'Email admin (identitas login)'],
            ['NEXT_PUBLIC_ADMIN_EMAIL', 'Email admin (untuk deteksi di browser)'],
            ['NEXT_PUBLIC_SUPABASE_URL', 'URL Supabase project'],
            ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Anon key Supabase'],
            ['SUPABASE_SERVICE_ROLE_KEY', 'Service role key Supabase (rahasia)'],
          ].map(([k, d]) => (
            <li key={k} className="text-xs text-amber-700">
              <code className="bg-amber-100 px-1 rounded">{k}</code>
              <span className="text-amber-600 ml-1">— {d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
