import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { LogoutButton } from '@/components/settings/LogoutButton'
import { User, Smartphone, Quote, Star, LogOut, Package, Wallet, Receipt } from 'lucide-react'

function getSubscriptionLabel(status: string | null, expiresAt: string | null) {
  if (status === 'active') return { label: 'Aktif', color: 'text-green-600', sub: 'Langganan aktif' }
  if (status === 'trial') {
    if (!expiresAt) return { label: 'Trial', color: 'text-yellow-600', sub: 'Periode trial' }
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    if (days <= 0) return { label: 'Trial Berakhir', color: 'text-red-600', sub: 'Langganan diperlukan' }
    return { label: 'Trial', color: 'text-yellow-600', sub: `Berakhir ${days} hari lagi` }
  }
  return { label: 'Tidak Aktif', color: 'text-red-600', sub: 'Hubungi admin' }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const { welcome } = await searchParams
  const supabase        = await createClient()
  const serviceSupabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  let { data: profile } = await (supabase.from('profiles') as any)
    .select('id, name, business_name, phone, slug, photo_url, bot_phone, subscription_status, trial_expires_at, plan_name, max_active_classes, max_broadcast_per_month, fonnte_token')
    .eq('id', user!.id)
    .single()

  if (!profile) {
    const defaultName = user!.email!.split('@')[0]
    const { data: created } = await (serviceSupabase.from('profiles') as any)
      .insert({ id: user!.id, name: defaultName })
      .select('id, name, business_name, phone, slug, photo_url, bot_phone, subscription_status, trial_expires_at, plan_name, fonnte_token')
      .single()
    profile = created
  }

  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('id, is_published')
    .eq('user_id', user!.id)
  const pendingCount = (testimonials ?? []).filter((t: any) => !t.is_published).length

  const isConnected = !!(profile?.bot_phone && profile.bot_phone.trim())
  const subStatus   = getSubscriptionLabel(profile?.subscription_status ?? 'trial', profile?.trial_expires_at ?? null)

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader title="Pengaturan" />

      {welcome === '1' && (
        <div className="mb-5 p-4 bg-violet-50 border border-violet-100 rounded-2xl">
          <p className="text-sm font-semibold text-violet-800">👋 Selamat datang di FitFlow Coach!</p>
          <p className="text-xs text-violet-600 mt-1">
            Lengkapi profil kamu agar peserta bisa menemukan halaman publikmu.
          </p>
        </div>
      )}

      {/* Email akun */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-gray-100 mb-4">
        <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Email login</p>
          <p className="text-sm font-medium text-gray-800 truncate">{user?.email}</p>
        </div>
      </div>

      {/* AKUN */}
      <SectionList label="Akun">
        <DetailRow
          icon={<User className="w-4 h-4" />}
          label="Profil Instruktur"
          sublabel={profile?.name ?? 'Lengkapi profil'}
          href="/settings/profile"
        />
      </SectionList>

      {/* BISNIS - jalur akses untuk Packages/Payment Profiles/Laporan di
          mobile, yang sebelumnya hanya ada di Sidebar desktop (BottomNav
          mobile tidak punya slot untuk 3 halaman ini sama sekali). */}
      <SectionList label="Bisnis">
        <DetailRow
          icon={<Receipt className="w-4 h-4" />}
          label="Laporan"
          sublabel="Revenue & rincian sumber pemasukan"
          href="/laporan"
        />
        <DetailRow
          icon={<Package className="w-4 h-4" />}
          label="Paket Membership"
          sublabel="Kelola paket untuk member"
          href="/packages"
        />
        <DetailRow
          icon={<Wallet className="w-4 h-4" />}
          label="Metode Pembayaran"
          sublabel="Untuk kelas & event"
          href="/payment-profiles"
        />
      </SectionList>

      {/* KONEKSI */}
      <SectionList label="Koneksi">
        <DetailRow
          icon={<Smartphone className="w-4 h-4" />}
          label="WhatsApp"
          sublabel={isConnected ? `Terhubung · ${profile?.bot_phone}` : 'Belum terhubung'}
          href="/settings/whatsapp"
          badge={isConnected ? (
            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-semibold">✓</span>
          ) : (
            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">!</span>
          )}
        />
      </SectionList>

      {/* KONTEN */}
      <SectionList label="Konten">
        <DetailRow
          icon={<Quote className="w-4 h-4" />}
          label="Testimoni"
          sublabel={pendingCount > 0 ? `${pendingCount} menunggu publikasi` : 'Tampil di landing page'}
          href="/settings/testimonials"
          badge={pendingCount > 0 ? (
            <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
              {pendingCount}
            </span>
          ) : undefined}
        />
      </SectionList>

      {/* LANGGANAN */}
      <SectionList label="Langganan">
        <DetailRow
          icon={<Star className="w-4 h-4" />}
          label={`Paket ${profile?.plan_name ?? 'Trial'}`}
          sublabel={subStatus.sub}
          href="/settings/subscription"
          badge={
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              subStatus.color === 'text-green-600' ? 'bg-green-100 text-green-600' :
              subStatus.color === 'text-yellow-600' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-600'
            }`}>
              {subStatus.label}
            </span>
          }
        />
      </SectionList>

      {/* AKSI */}
      <SectionList label="Aksi">
        <div className="px-4 py-3">
          <LogoutButton />
        </div>
      </SectionList>
    </div>
  )
}
