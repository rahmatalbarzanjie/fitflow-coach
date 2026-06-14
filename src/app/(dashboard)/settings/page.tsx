import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Card } from '@/components/ui/card'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { User, ExternalLink, Webhook, Copy } from 'lucide-react'
import { CopySecretButton } from '@/components/settings/CopySecretButton'

export default async function SettingsPage() {
  const supabase        = await createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  type ProfileRow = { id: string; name: string; business_name: string | null; phone: string | null; slug: string | null; photo_url?: string | null }

  // Ambil profil — auto-create jika belum ada (misalnya user lama sebelum trigger dibuat)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: profile } = await (supabase.from('profiles') as any)
    .select('id, name, business_name, phone, slug, photo_url')
    .eq('id', user!.id)
    .single() as { data: ProfileRow | null }

  if (!profile) {
    const defaultName = user!.email!.split('@')[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created } = await (serviceSupabase.from('profiles') as any)
      .insert({ id: user!.id, name: defaultName })
      .select('id, name, business_name, phone, slug, photo_url')
      .single() as { data: ProfileRow | null }
    profile = created
  }

  const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const webhookSecret = process.env.NODERED_WEBHOOK_SECRET ?? '(belum diset di .env)'

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-400 mt-0.5">Profil instruktur dan konfigurasi sistem</p>
      </div>

      {/* Email akun */}
      <div className="flex items-center gap-3 p-3 mb-6 bg-gray-50 rounded-xl border border-gray-100">
        <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Email login</p>
          <p className="text-sm font-medium text-gray-800 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Form profil */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Profil Instruktur</h2>
        <p className="text-xs text-gray-400 mb-5">
          Lengkapi profil agar peserta bisa mengenali kamu di halaman publik.
        </p>
        {profile ? (
          <ProfileForm profile={profile} appUrl={appUrl} />
        ) : (
          <p className="text-sm text-gray-400">
            Gagal memuat profil. Coba refresh halaman.
          </p>
        )}
      </Card>

      {/* Halaman publik */}
      {profile?.slug ? (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Halaman Publik</h2>
          <p className="text-xs text-gray-500 mb-3">
            Share link ini ke peserta untuk pendaftaran event.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl">
              <div>
                <p className="text-xs text-violet-500">Halaman profil</p>
                <p className="text-xs font-mono text-violet-700">{appUrl}/{profile.slug}</p>
              </div>
              <a
                href={`${appUrl}/${profile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-violet-600 hover:underline shrink-0"
              >
                Buka <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-gray-400">
              Link per event: /{profile.slug}/daftar/[slug-event]
            </p>
          </div>
        </Card>
      ) : profile && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Halaman Publik</h2>
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs text-amber-700 font-medium mb-1">Slug belum diisi</p>
            <p className="text-xs text-amber-600">
              Isi field <strong>Slug URL Publik</strong> di form Profil di atas
              agar peserta bisa mendaftar event kamu secara online.
            </p>
          </div>
        </Card>
      )}

      {/* Node-RED / Webhook config */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Webhook className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Node-RED Integration</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Secret ini dipakai di setiap node Function di Node-RED.
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Webhook Secret</p>
            <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <code className="text-xs font-mono text-gray-700 flex-1 break-all">
                {webhookSecret}
              </code>
              <CopySecretButton value={webhookSecret} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">UUID kamu (untuk Flow 3 Node-RED)</p>
            <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <code className="text-xs font-mono text-gray-700 flex-1 break-all">
                {user!.id}
              </code>
              <CopySecretButton value={user!.id} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Endpoint webhook</p>
            <code className="block text-xs font-mono text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 break-all">
              {appUrl}/api/webhooks/nodered
            </code>
          </div>
        </div>
      </Card>
    </div>
  )
}
