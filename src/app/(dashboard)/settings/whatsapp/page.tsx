import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { WhatsAppDisconnectButton } from '@/components/settings/WhatsAppDisconnectButton'
import { Smartphone, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function SettingsWhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('bot_phone, bot_phone_requested, fonnte_token')
    .eq('id', user!.id)
    .single()

  if (!profile) notFound()

  const isConnected  = !!(profile.bot_phone?.trim())
  const isPending    = !isConnected && !!(profile.bot_phone_requested?.trim())
  const hasToken     = !!(profile.fonnte_token?.trim())

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/settings" title="WhatsApp" />

      {/* Status card */}
      <div className={`flex items-center gap-3 px-4 py-4 rounded-2xl border mb-4 ${
        isConnected
          ? 'bg-green-50 border-green-100'
          : isPending || hasToken
          ? 'bg-yellow-50 border-yellow-100'
          : 'bg-gray-50 border-gray-100'
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isConnected ? 'bg-green-100' : isPending || hasToken ? 'bg-yellow-100' : 'bg-gray-100'
        }`}>
          {isConnected
            ? <CheckCircle className="w-5 h-5 text-green-600" />
            : isPending || hasToken
            ? <Clock className="w-5 h-5 text-yellow-600" />
            : <AlertCircle className="w-5 h-5 text-gray-400" />
          }
        </div>
        <div>
          <p className={`text-sm font-bold ${
            isConnected ? 'text-green-700' : isPending || hasToken ? 'text-yellow-700' : 'text-gray-700'
          }`}>
            {isConnected ? 'Terhubung' : isPending || hasToken ? 'Sedang Menghubungkan...' : 'Belum Terhubung'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isConnected
              ? profile.bot_phone
              : isPending
              ? `Nomor ${profile.bot_phone_requested} menunggu konfirmasi`
              : 'Hubungkan WhatsApp untuk broadcast dan notifikasi otomatis'}
          </p>
        </div>
      </div>

      {/* Manfaat — tampilkan hanya kalau belum terhubung */}
      {!isConnected && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dengan WhatsApp terhubung:</p>
          <ul className="space-y-2">
            {[
              'Broadcast ke member sebelum kelas',
              'Notifikasi konfirmasi event otomatis',
              'Follow up peserta yang belum hadir',
              'Bot AI menjawab pertanyaan member',
            ].map(item => (
              <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-violet-500 font-bold">✓</span> {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Aksi */}
      <SectionList label={isConnected ? 'Koneksi' : 'Hubungkan'}>
        {isConnected ? (
          <>
            <DetailRow
              icon={<Smartphone className="w-4 h-4" />}
              label="Nomor Terhubung"
              value={profile.bot_phone}
              chevron={false}
            />
            <div className="px-4 py-3">
              <WhatsAppDisconnectButton />
            </div>
          </>
        ) : (
          <div className="px-4 py-4">
            <Link
              href="/settings/whatsapp/connect"
              className="flex items-center justify-center gap-2 w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              Hubungkan WhatsApp
            </Link>
          </div>
        )}
      </SectionList>
    </div>
  )
}
