import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { ProfileForm } from '@/components/settings/ProfileForm'

export default async function SettingsProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('id, name, business_name, phone, slug, photo_url, bio')
    .eq('id', user!.id)
    .single()

  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const appUrl    = rawAppUrl && !rawAppUrl.startsWith('http') ? `https://${rawAppUrl}` : rawAppUrl

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader backHref="/settings" title="Profil Instruktur" />
      <SectionList>
        <div className="px-4 py-5">
          {profile
            ? <ProfileForm profile={profile} appUrl={appUrl} />
            : <p className="text-sm text-gray-400">Gagal memuat profil. Coba refresh.</p>
          }
        </div>
      </SectionList>
    </div>
  )
}
