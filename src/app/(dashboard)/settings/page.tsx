import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Card } from '@/components/ui/card'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { User, ExternalLink, Webhook, MessageCircle, Quote } from 'lucide-react'
import { CopySecretButton } from '@/components/settings/CopySecretButton'
import { LogoutButton } from '@/components/settings/LogoutButton'
import { WhatsAppSettingsForm } from '@/components/settings/WhatsAppSettingsForm'
import { TestimonialsManager } from '@/components/settings/TestimonialsManager'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const { welcome } = await searchParams
  const supabase        = await createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  type ProfileRow = { id: string; name: string; business_name: string | null; phone: string | null; slug: string | null; photo_url?: string | null; bio?: string | null; bot_phone?: string | null; bot_phone_requested?: string | null; fonnte_token?: string | null }

  // Ambil profil — auto-create jika belum ada (misalnya user lama sebelum trigger dibuat)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: profile } = await (supabase.from('profiles') as any)
    .select('id, name, business_name, phone, slug, photo_url, bio, bot_phone, bot_phone_requested, fonnte_token')
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

  const { data: testimonialsRaw } = await supabase
    .from('testimonials')
    .select('id, name, content, photo_url, is_published, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
  const testimonials = testimonialsRaw ?? []

  const rawAppUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const appUrl        = rawAppUrl && !rawAppUrl.startsWith('http') ? `https://${rawAppUrl}` : rawAppUrl
  const webhookSecret = process.env.NODERED_WEBHOOK_SECRET ?? '(belum diset di .env)'
  const isAdmin       = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-400 mt-0.5">Profil instruktur dan konfigurasi sistem</p>
      </div>

      {welcome === '1' && (
        <div className="mb-6 p-4 bg-violet-50 border border-violet-100 rounded-2xl">
          <p className="text-sm font-semibold text-violet-800">👋 Selamat datang di FitFlow Coach!</p>
          <p className="text-xs text-violet-600 mt-1">
            Lengkapi profil di bawah — terutama <strong>Nama</strong>, <strong>Nama Studio</strong>,
            dan <strong>Slug URL</strong> agar halaman publikmu bisa diakses peserta.
          </p>
        </div>
      )}

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

      {/* Nomor bot WhatsApp — untuk broadcast & otomasi, beda dari nomor pribadi */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Nomor Bot WhatsApp</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Dipakai khusus untuk broadcast ke member, auto-reply AI, dan post ke grup komunitas.
        </p>
        <WhatsAppSettingsForm
          initialBotPhone={profile?.bot_phone ?? ''}
          initialBotPhoneRequested={profile?.bot_phone_requested ?? ''}
          initialHasToken={!!(profile?.fonnte_token && profile.fonnte_token.trim().length > 10)}
        />
      </Card>

      {/* Testimoni */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Quote className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Testimoni</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Tampil di landing page untuk meyakinkan calon peserta.
        </p>
        <TestimonialsManager initialTestimonials={testimonials as any[]} />
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

      {/* Logout */}
      <div className="mb-6">
        <LogoutButton />
      </div>

      {/* Node-RED / Webhook config — admin only */}
      {isAdmin && <Card>
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
      </Card>}
    </div>
  )
}
