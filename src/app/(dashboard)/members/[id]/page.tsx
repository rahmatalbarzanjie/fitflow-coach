import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { DetailRow } from '@/components/ui/DetailRow'
import { MemberAvatar } from '@/components/members/MemberPhotoUpload'
import { MemberStatusBadge } from '@/components/members/MemberStatusBadge'
import { formatRupiah } from '@/lib/utils'
import {
  MessageSquareQuote, BookOpen,
  Settings, BarChart2, Calendar, Trophy, Banknote,
} from 'lucide-react'

function getTodayWIB() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return wib.toISOString().split('T')[0]
}

function timeAgoFromDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Hari ini'
  if (days === 1) return 'Kemarin'
  if (days < 30)  return `${days} hari yang lalu`
  const months = Math.floor(days / 30)
  return `${months} bulan yang lalu`
}

export default async function MemberHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Fix #2: Satu query member, tidak duplikat ─────────────────────────────
  const [memberRes, profileRes, attendanceRes] = await Promise.all([
    (supabase.from('members') as any)
      .select('id, name, phone, notes, photo_url, status, last_attended_at')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single(),

    (supabase.from('profiles') as any)
      .select('slug')
      .eq('id', user!.id)
      .single(),

    supabase
      .from('attendance')
      .select('id, created_at, amount_paid')
      .eq('member_id', id),
  ])

  const member = memberRes.data
  if (!member) notFound()

  // Hitung statistik
  const allAttendance     = (attendanceRes.data ?? []) as any[]
  const totalAttended     = allAttendance.length
  const thisMonthStr      = getTodayWIB().substring(0, 7)
  const attendedThisMonth = allAttendance.filter(a =>
    a.created_at?.startsWith(thisMonthStr)
  ).length
  const totalRevenue = allAttendance.reduce(
    (sum, a) => sum + (Number(a.amount_paid) || 0), 0
  )
  const lastAttended = member.last_attended_at
    ? timeAgoFromDate(member.last_attended_at)
    : null

  // Link testimoni
  const appUrl         = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const slug           = profileRes.data?.slug ?? null
  const testimonialUrl = slug ? `${appUrl}/${slug}/testimoni/${member.id}` : null
  const memberWa       = member.phone?.replace(/\D/g, '').replace(/^0/, '62')
  const testimonialWaLink = testimonialUrl && memberWa
    ? `https://wa.me/${memberWa}?text=${encodeURIComponent(
        `Halo ${member.name}! Boleh minta waktu sebentar untuk kasih testimoni soal kelas yang sudah diikuti? 🙏\n\n${testimonialUrl}`
      )}`
    : null

  // ── Evaluasi empty state ──────────────────────────────────────────────────
  // Member baru = belum pernah hadir sama sekali
  const isNewMember = totalAttended === 0

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/members" title={member.name} />

      {/* Profil singkat */}
      <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-4">
        <MemberAvatar photoUrl={member.photo_url} name={member.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-gray-900">{member.name}</p>
            <MemberStatusBadge status={member.status} />
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{member.phone}</p>
          {member.notes && (
            <p className="text-xs text-gray-400 mt-1 italic">"{member.notes}"</p>
          )}
        </div>
      </div>

      {/* ── Empty state untuk member baru ── */}
      {isNewMember ? (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-5 mb-4 text-center">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm font-semibold text-violet-800">Member baru</p>
          <p className="text-xs text-violet-500 mt-1 leading-relaxed">
            Belum ada riwayat kehadiran.{'\n'}
            Catat kehadiran pertama melalui menu Absensi di halaman Kelas.
          </p>
        </div>
      ) : (
        /* Section: Statistik — hanya tampil kalau sudah pernah hadir */
        <SectionList label="Statistik">
          <DetailRow
            icon={<BarChart2 className="w-4 h-4" />}
            label="Kehadiran Bulan Ini"
            value={`${attendedThisMonth} sesi`}
            chevron={false}
          />
          <DetailRow
            icon={<Calendar className="w-4 h-4" />}
            label="Terakhir Hadir"
            value={lastAttended ?? 'Belum pernah'}
            chevron={false}
          />
          <DetailRow
            icon={<Trophy className="w-4 h-4" />}
            label="Total Hadir"
            value={`${totalAttended} sesi`}
            chevron={false}
          />
          <DetailRow
            icon={<Banknote className="w-4 h-4" />}
            label="Total Pembayaran"
            value={formatRupiah(totalRevenue)}
            chevron={false}
          />
        </SectionList>
      )}

      {/* Section: Operasional */}
      <SectionList label="Operasional">
        <DetailRow
          icon={<BookOpen className="w-4 h-4" />}
          label="Riwayat Kehadiran"
          sublabel={totalAttended > 0 ? `${totalAttended} sesi tercatat` : 'Belum ada kehadiran'}
          href={`/members/${id}/attendance`}
        />
        {testimonialWaLink ? (
          <DetailRow
            icon={<MessageSquareQuote className="w-4 h-4" />}
            label="Minta Testimoni"
            sublabel="Kirim link testimoni via WhatsApp"
            href={testimonialWaLink}
          />
        ) : (
          <DetailRow
            icon={<MessageSquareQuote className="w-4 h-4" />}
            label="Minta Testimoni"
            sublabel="Atur slug profil di Pengaturan terlebih dahulu"
            disabled
          />
        )}
      </SectionList>

      {/* Section: Pengaturan */}
      <SectionList label="Pengaturan">
        <DetailRow
          icon={<Settings className="w-4 h-4" />}
          label="Pengaturan Member"
          sublabel="Nama, HP, foto, catatan, dan hapus"
          href={`/members/${id}/settings`}
        />
      </SectionList>
    </div>
  )
}
