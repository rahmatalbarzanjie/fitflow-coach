import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { PeriodNav } from '@/components/laporan/PeriodNav'
import { SummaryCards } from '@/components/laporan/SummaryCards'
import { ActionSnapshot, type ActionItem } from '@/components/laporan/ActionSnapshot'
import { ClassOccupancyList } from '@/components/laporan/ClassOccupancyList'
import { BusinessPulse } from '@/components/laporan/BusinessPulse'
import { MarketingSection } from '@/components/laporan/MarketingSection'
import { OperationalSection } from '@/components/laporan/OperationalSection'
import { EmptyState } from '@/components/laporan/EmptyState'
import { getSubscriptionLabel } from '@/lib/subscription'
import { checkClassQuota, checkBroadcastQuota } from '@/lib/quota'
import { formatRupiah } from '@/lib/utils'
import { PAYMENT_METHOD } from '@/lib/constants'
import { Users, MessageCircle, Calendar, PartyPopper, Clock, AlertTriangle, TrendingDown, Hourglass } from 'lucide-react'

// Laporan V2 - lihat docs/LAPORAN_V2_BUSINESS_REPORT_DESIGN.md untuk desain
// produk lengkap (Owner Questions Framework §2A menjelaskan kenapa setiap
// section di bawah ada). Revenue SELALU lewat RPC get_laporan_revenue -
// satu sumber kebenaran, supaya tidak terulang insiden Beranda vs Laporan
// beda angka (migrasi 046). Status member SELALU lewat member_summary
// (derived, Phase 1 Member Status Architecture) - tidak pernah baca
// members.status mentah.

const MONTH_RE = /^\d{4}-\d{2}$/

function getCurrentMonthWIB(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthToRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function prevMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface RevenueResult {
  revenue_event: number
  revenue_class: number
  revenue_membership_gross: number
  revenue_membership_refund: number
  revenue_walkin: number
  pending_count: number
  pending_amount: number
  payment_method_breakdown: Record<string, number>
}

interface ClassOccupancy {
  id: string
  name: string
  capacity: number | null
  session_count: number
  attendance_count: number
  revenue: number
  revenue_share_pct: number
  net_revenue: number
}

interface MemberHealth {
  active_count: number
  at_risk_count: number
  inactive_count: number
  member_baru_count: number
  member_lama_aktif_count: number
  member_lost_count: number
}

interface BroadcastStats {
  sent_count: number
  failed_count: number
  pending_count: number
}

interface LowOccupancySession {
  session_id: string
  class_id: string
  class_name: string
  session_date: string
  capacity: number
  booked_count: number
  occupancy_pct: number
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const currentMonth = getCurrentMonthWIB()
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : currentMonth

  const { start: periodStart, end: periodEnd } = monthToRange(month)
  const { start: prevStart, end: prevEnd } = monthToRange(prevMonthOf(month))
  const periodEndTs = `${periodEnd}T23:59:59`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [
    revenueRes,
    prevRevenueRes,
    occupancyRes,
    memberHealthRes,
    contactsRes,
    eventRegsRes,
    attendanceCountRes,
    broadcastStatsRes,
    lowOccupancyRes,
    profileRes,
    classQuota,
    broadcastQuota,
  ] = await Promise.all([
    supabase.rpc('get_laporan_revenue', { p_user_id: userId, p_period_start: periodStart, p_period_end: periodEnd }),
    supabase.rpc('get_laporan_revenue', { p_user_id: userId, p_period_start: prevStart, p_period_end: prevEnd }),
    supabase.rpc('get_class_occupancy', { p_user_id: userId, p_period_start: periodStart, p_period_end: periodEnd }),
    supabase.rpc('get_member_health', {
      p_user_id: userId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_prev_period_start: prevStart,
      p_prev_period_end: prevEnd,
    }),
    supabase.from('community_contacts').select('id, created_at, converted_member_id').eq('user_id', userId),
    supabase.from('event_registration_summary')
      .select('event_id, event_title, amount_paid, tier, confirmed_at')
      .not('confirmed_at', 'is', null)
      .gte('confirmed_at', periodStart)
      .lte('confirmed_at', periodEndTs),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', periodStart).lte('created_at', periodEndTs),
    supabase.rpc('get_broadcast_stats', { p_user_id: userId, p_period_start: periodStart, p_period_end: periodEnd }),
    supabase.rpc('get_upcoming_low_occupancy', { p_user_id: userId }),
    supabase.from('profiles').select('subscription_status, trial_expires_at').eq('id', userId).single(),
    checkClassQuota(supabase, userId),
    checkBroadcastQuota(supabase, userId, 0),
  ])

  const revenue     = (revenueRes.data ?? {}) as unknown as RevenueResult
  const prevRevenue = (prevRevenueRes.data ?? {}) as unknown as RevenueResult
  const classes     = (occupancyRes.data ?? []) as unknown as ClassOccupancy[]
  const memberHealth = (memberHealthRes.data ?? {}) as unknown as MemberHealth
  const contacts    = contactsRes.data ?? []
  const eventRegs   = (eventRegsRes.data ?? []) as { event_id: string; event_title: string; amount_paid: number; tier: string }[]
  const attendanceCount = attendanceCountRes.count ?? 0
  const broadcastStats = (broadcastStatsRes.data ?? {}) as unknown as BroadcastStats
  const lowOccupancySessions = (lowOccupancyRes.data ?? []) as unknown as LowOccupancySession[]
  const profile = profileRes.data as { subscription_status: string | null; trial_expires_at: string | null } | null

  // ── Keuangan (Financial Intelligence) ───────────────────────────────────
  // Membership Net = Gross periode ini DIKURANGI Refund periode ini -
  // keduanya di-scope ke PERIODE MASING-MASING (created_at vs refunded_at),
  // bukan per-baris. Keputusan bisnis: refund masuk ke bulan refund terjadi,
  // bukan koreksi retroaktif ke bulan pembelian (lihat migrasi 067) - jadi
  // bulan pembelian tetap tampil gross penuh, bulan refund bisa negatif.
  const membershipGross    = revenue.revenue_membership_gross ?? 0
  const membershipRefund   = revenue.revenue_membership_refund ?? 0
  const membershipNet      = membershipGross - membershipRefund
  const prevMembershipNet  = (prevRevenue.revenue_membership_gross ?? 0) - (prevRevenue.revenue_membership_refund ?? 0)

  // Prepaid (Membership) vs Pay-per-Visit (Kelas+Event+Walk-in) - BUKAN
  // "Recurring vs Transactional" (locked rename, KPI Trust Audit): paket
  // membership di FitFlow adalah pembelian sesi di muka, bukan subscription
  // dengan auto-renewal - istilah "recurring" menyiratkan sesuatu yang
  // tidak ada di mekanismenya.
  const payPerVisit = revenue.revenue_class + revenue.revenue_event + revenue.revenue_walkin
  const totalRevenue     = payPerVisit + membershipNet
  const prevTotalRevenue = (prevRevenue.revenue_class + prevRevenue.revenue_event + prevRevenue.revenue_walkin) + prevMembershipNet
  const grossRevenue     = payPerVisit + membershipGross
  const revenueGrowthPct = prevTotalRevenue > 0 ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100) : null
  const prepaidPct       = totalRevenue > 0 ? Math.round((membershipNet / totalRevenue) * 100) : null

  const revenueBreakdown = [
    { label: 'Kelas',   value: revenue.revenue_class },
    { label: 'Event',   value: revenue.revenue_event },
    { label: 'Walk-in', value: revenue.revenue_walkin },
  ]
  const methodBreakdown = Object.entries(revenue.payment_method_breakdown ?? {})

  // ── Komunitas (Community Funnel) ────────────────────────────────────────
  const contactTotal = contacts.length
  const contactNewThisPeriod = contacts.filter(c => !!c.created_at && c.created_at >= periodStart && c.created_at <= periodEndTs).length
  // Konversi KUMULATIF sepanjang waktu, bukan per-periode - tidak ada
  // kolom converted_at di skema, jadi "konversi bulan ini" tidak bisa
  // dihitung akurat. Tampilkan sebagai fakta lifetime, bukan periode.
  const contactConverted = contacts.filter(c => c.converted_member_id).length
  const conversionRate = contactTotal > 0 ? Math.round((contactConverted / contactTotal) * 100) : 0

  // ── Kelas (Class Performance) ────────────────────────────────────────────
  // Satu list gabungan (revenue + kehadiran + occupancy per baris), diurutkan
  // by-revenue - bukan 3 list terpisah seperti sebelumnya (temuan UX audit
  // T2.1: untuk studio kecil, 3 list itu cuma menampilkan kelas yang sama
  // berulang-ulang, nol insight baru).
  const classesSorted = [...classes].sort((a, b) => b.revenue - a.revenue)
  // Bagian instruktur dari revenue Kelas+Walk-in (revenue_share_pct per
  // kelas, lihat migrasi 010/084) - cuma ditampilkan kalau ada kelas yang
  // split-nya bukan 100%, supaya instruktur yang ambil semua bagiannya
  // sendiri tidak melihat baris yang percuma (selalu sama dengan total).
  const hasRevenueSplit = classes.some(c => c.revenue_share_pct < 100)
  const instructorClassShare = classes.reduce((sum, c) => sum + Number(c.net_revenue), 0)
  const occupancyPcts = classes
    .filter(c => c.session_count > 0 && c.capacity !== null && c.capacity > 0)
    .map(c => (c.attendance_count / (c.capacity! * c.session_count)) * 100)
  const avgOccupancyPct = occupancyPcts.length > 0
    ? Math.round(occupancyPcts.reduce((s, v) => s + v, 0) / occupancyPcts.length)
    : null

  // ── Event (Event Performance) ───────────────────────────────────────────
  const eventGrouped = new Map<string, { title: string; revenue: number; count: number; earlyBird: number; ots: number }>()
  eventRegs.forEach(r => {
    const existing = eventGrouped.get(r.event_id) ?? { title: r.event_title, revenue: 0, count: 0, earlyBird: 0, ots: 0 }
    existing.revenue += Number(r.amount_paid)
    existing.count += 1
    if (r.tier === 'early_bird') existing.earlyBird += 1
    else existing.ots += 1
    eventGrouped.set(r.event_id, existing)
  })
  const eventList = [...eventGrouped.values()].sort((a, b) => b.revenue - a.revenue)

  // ── Operasional + trial ──────────────────────────────────────────────────
  const subStatus = getSubscriptionLabel(profile?.subscription_status ?? 'trial', profile?.trial_expires_at ?? null)
  const trialDaysLeft = profile?.trial_expires_at
    ? Math.ceil((new Date(profile.trial_expires_at).getTime() - Date.now()) / 86_400_000)
    : null

  // ── Action Required ──────────────────────────────────────────────────────
  // Cuma tampilkan kondisi yang BENAR-BENAR butuh tindakan - bukan 4 kartu
  // permanen yang sering kosong (noise, lihat KPI Trust Audit).
  const actionItems: ActionItem[] = []
  if ((revenue.pending_count ?? 0) > 0) {
    actionItems.push({
      icon: Clock, iconBg: 'bg-orange-100', iconColor: 'text-orange-500',
      title: `${revenue.pending_count} pembayaran belum dikonfirmasi`,
      subtitle: `${formatRupiah(revenue.pending_amount ?? 0)} menunggu`,
    })
  }
  if (memberHealth.at_risk_count > 0) {
    actionItems.push({
      icon: AlertTriangle, iconBg: 'bg-orange-100', iconColor: 'text-orange-500',
      title: `${memberHealth.at_risk_count} member perlu follow up`,
      subtitle: '15-30 hari tanpa aktivitas',
      href: '/members',
    })
  }
  if (lowOccupancySessions.length > 0) {
    actionItems.push({
      icon: TrendingDown, iconBg: 'bg-red-50', iconColor: 'text-red-500',
      title: `${lowOccupancySessions.length} kelas minggu ini masih kosong`,
      subtitle: lowOccupancySessions.slice(0, 2).map(s => s.class_name).join(', '),
    })
  }
  if (trialDaysLeft !== null && trialDaysLeft <= 7) {
    actionItems.push({
      icon: Hourglass, iconBg: 'bg-yellow-50', iconColor: 'text-yellow-600',
      title: trialDaysLeft <= 0 ? 'Trial sudah berakhir' : `Trial berakhir ${trialDaysLeft} hari lagi`,
      subtitle: 'Hubungi admin untuk perpanjangan',
    })
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader title="Laporan" subtitle="Kondisi bisnismu, satu halaman" />

      <PeriodNav month={month} currentMonth={currentMonth} />

      <div className="mb-4">
        <SummaryCards
          revenue={totalRevenue}
          previousRevenue={prevTotalRevenue}
          memberNew={memberHealth.member_baru_count ?? 0}
          attendanceCount={attendanceCount}
        />
      </div>

      {/* Business Pulse */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Business Pulse</p>
        <BusinessPulse
          revenueGrowthPct={revenueGrowthPct}
          activeMemberCount={memberHealth.active_count ?? 0}
          avgOccupancyPct={avgOccupancyPct}
          prepaidPct={prepaidPct}
          pendingAmount={revenue.pending_amount ?? 0}
        />
      </div>

      {/* Action Required */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Action Required</p>
        <p className="text-xs text-gray-400 px-1 mb-2">Hal-hal yang membutuhkan perhatian Anda</p>
        <ActionSnapshot items={actionItems} />
      </div>

      {/* Keuangan (Financial Intelligence) */}
      <SectionList
        label="Keuangan"
        footer={
          totalRevenue === 0
            ? `Belum ada revenue tercatat untuk ${month === currentMonth ? 'bulan ini' : 'periode ini'}.`
            : hasRevenueSplit
              ? 'Bagian Kamu = revenue Kelas + Walk-in dikali persentase bagi hasil tiap kelas (diatur di pengaturan kelas).'
              : undefined
        }
      >
        <div className="flex items-center justify-between px-4 py-3 bg-violet-50">
          <span className="text-sm font-semibold text-gray-700">Net Revenue</span>
          <span className="text-sm font-bold text-violet-700">{formatRupiah(totalRevenue)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-700">Gross Revenue</span>
          <span className="text-sm font-semibold text-gray-900">{formatRupiah(grossRevenue)}</span>
        </div>
        {membershipRefund > 0 && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">Refund Revenue</span>
            <span className="text-sm font-semibold text-red-500">- {formatRupiah(membershipRefund)}</span>
          </div>
        )}
        {revenueBreakdown.slice(0, 2).map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">{label}</span>
            <span className="text-sm font-semibold text-gray-900">{formatRupiah(value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-700">Membership Net</span>
          <span className="text-sm font-semibold text-gray-900">{formatRupiah(membershipNet)}</span>
        </div>
        {revenueBreakdown.slice(2).map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">{label}</span>
            <span className="text-sm font-semibold text-gray-900">{formatRupiah(value)}</span>
          </div>
        ))}
        {hasRevenueSplit && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <span className="text-sm text-gray-700">↳ Bagian Kamu (Kelas + Walk-in)</span>
            <span className="text-sm font-semibold text-violet-700">{formatRupiah(instructorClassShare)}</span>
          </div>
        )}
      </SectionList>

      {/* Revenue Mix - Prepaid vs Pay-per-Visit */}
      <div className="mt-4">
        <SectionList label="Revenue Mix" footer="Prepaid = paket membership (dibeli di muka). Pay-per-Visit = kelas, event, dan walk-in per kunjungan.">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">Prepaid (Membership)</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatRupiah(membershipNet)}{prepaidPct !== null && ` (${prepaidPct}%)`}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">Pay-per-Visit</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatRupiah(payPerVisit)}{prepaidPct !== null && ` (${100 - prepaidPct}%)`}
            </span>
          </div>
        </SectionList>
      </div>

      {methodBreakdown.length > 0 && (
        <div className="mt-4">
          <SectionList label="Metode Pembayaran (periode ini)">
            {methodBreakdown.map(([method, total]) => (
              <div key={method} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700">
                  {PAYMENT_METHOD[method as keyof typeof PAYMENT_METHOD]?.label ?? 'Lainnya'}
                </span>
                <span className="text-sm font-semibold text-gray-900">{formatRupiah(Number(total))}</span>
              </div>
            ))}
          </SectionList>
        </div>
      )}

      {/* Member Health */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Member Health</p>
        <p className="text-xs text-gray-400 px-1 mb-2">
          Status dihitung dari Business Activity (kehadiran Kelas + Event), bukan snapshot tersimpan.
        </p>
        {(memberHealth.active_count ?? 0) + (memberHealth.at_risk_count ?? 0) + (memberHealth.inactive_count ?? 0) === 0 ? (
          <EmptyState
            icon={Users}
            message="Belum ada member - peserta kelas/event reguler tetap tercatat di Keuangan & Kelas"
            ctaHref="/members/new"
            ctaLabel="Tambah Member"
          />
        ) : (
          <SectionList footer="Member Baru = bergabung di periode ini. Member Lama Aktif = sudah bergabung sebelumnya dan masih aktif. Member Hilang = aktif periode lalu, tidak aktif periode ini.">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Aktif</span>
              <span className="text-sm font-semibold text-green-600">{memberHealth.active_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Perlu Follow Up</span>
              <span className="text-sm font-semibold text-orange-600">{memberHealth.at_risk_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Tidak Aktif</span>
              <span className="text-sm font-semibold text-gray-500">{memberHealth.inactive_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Member Baru (akuisisi)</span>
              <span className="text-sm font-semibold text-blue-600">{memberHealth.member_baru_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Member Lama Aktif (retensi)</span>
              <span className="text-sm font-semibold text-gray-900">{memberHealth.member_lama_aktif_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Member Hilang</span>
              <span className="text-sm font-semibold text-red-500">{memberHealth.member_lost_count ?? 0}</span>
            </div>
          </SectionList>
        )}
      </div>

      {/* Komunitas (Community Funnel) */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Komunitas</p>
        {contactTotal === 0 ? (
          <EmptyState
            icon={MessageCircle}
            message="Belum ada kontak komunitas"
            ctaHref="/community/new"
            ctaLabel="Tambah Kontak"
          />
        ) : (
          <SectionList footer="Konversi ke Member dihitung sepanjang waktu (kumulatif), bukan cuma di periode ini.">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Total Kontak</span>
              <span className="text-sm font-semibold text-gray-900">{contactTotal}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Kontak Baru (periode ini)</span>
              <span className="text-sm font-semibold text-gray-900">{contactNewThisPeriod}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Sudah jadi Member</span>
              <span className="text-sm font-semibold text-gray-900">
                {contactConverted > 0 ? `${contactConverted} (${conversionRate}%)` : 'Belum ada konversi - ajak kontak jadi member'}
              </span>
            </div>
          </SectionList>
        )}
      </div>

      {/* Kelas (Class Performance) */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Kelas</p>
        {classes.length === 0 ? (
          <EmptyState icon={Calendar} message="Belum ada kelas aktif" ctaHref="/classes/new" ctaLabel="Tambah Kelas" />
        ) : (
          <ClassOccupancyList classes={classesSorted} />
        )}
      </div>

      {/* Event (Event Performance) */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Event</p>
        {eventList.length === 0 ? (
          <EmptyState icon={PartyPopper} message="Belum ada event di periode ini" ctaHref="/events/new" ctaLabel="Buat Event" />
        ) : (
          <SectionList>
            {eventList.map(e => (
              <div key={e.title} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate">{e.title}</span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0 ml-3">{formatRupiah(e.revenue)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {e.count} peserta - {e.earlyBird} Early Bird, {e.ots} Reguler
                </p>
              </div>
            ))}
          </SectionList>
        )}
      </div>

      {/* Marketing */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Marketing</p>
        <MarketingSection
          sentCount={broadcastStats.sent_count ?? 0}
          failedCount={broadcastStats.failed_count ?? 0}
          pendingCount={broadcastStats.pending_count ?? 0}
        />
      </div>

      {/* Operasional */}
      <div className="mt-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Operasional</p>
        <OperationalSection
          classUsed={classQuota.used}
          classLimit={classQuota.limit}
          broadcastUsed={broadcastQuota.used}
          broadcastLimit={broadcastQuota.limit}
          subscriptionLabel={subStatus.label}
          subscriptionSub={subStatus.sub}
        />
      </div>
    </div>
  )
}
