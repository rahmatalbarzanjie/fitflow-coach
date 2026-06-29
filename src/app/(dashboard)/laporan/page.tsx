import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionList } from '@/components/ui/SectionList'
import { PeriodNav } from '@/components/laporan/PeriodNav'
import { SummaryCards } from '@/components/laporan/SummaryCards'
import { ActionSnapshot } from '@/components/laporan/ActionSnapshot'
import { ClassOccupancyList } from '@/components/laporan/ClassOccupancyList'
import { EmptyState } from '@/components/laporan/EmptyState'
import { formatRupiah } from '@/lib/utils'
import { PAYMENT_METHOD, MEMBER_STATUS } from '@/lib/constants'
import { Users, MessageCircle, Calendar, PartyPopper } from 'lucide-react'

// Laporan V2 - lihat docs/LAPORAN_V2_BUSINESS_REPORT_DESIGN.md untuk desain
// produk lengkap (Owner Questions Framework §2A menjelaskan kenapa setiap
// section di bawah ada). Revenue SELALU lewat RPC get_laporan_revenue -
// satu sumber kebenaran, supaya tidak terulang insiden Beranda vs Laporan
// beda angka (migrasi 046).

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
  revenue_membership: number
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
    membersRes,
    contactsRes,
    eventRegsRes,
    attendanceCountRes,
  ] = await Promise.all([
    supabase.rpc('get_laporan_revenue', { p_user_id: userId, p_period_start: periodStart, p_period_end: periodEnd }),
    supabase.rpc('get_laporan_revenue', { p_user_id: userId, p_period_start: prevStart, p_period_end: prevEnd }),
    supabase.rpc('get_class_occupancy', { p_user_id: userId, p_period_start: periodStart, p_period_end: periodEnd }),
    supabase.from('members').select('id, status, created_at').eq('user_id', userId),
    supabase.from('community_contacts').select('id, created_at, converted_member_id').eq('user_id', userId),
    supabase.from('event_registration_summary')
      .select('event_id, event_title, amount_paid, tier, confirmed_at')
      .not('confirmed_at', 'is', null)
      .gte('confirmed_at', periodStart)
      .lte('confirmed_at', periodEndTs),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', periodStart).lte('created_at', periodEndTs),
  ])

  const revenue     = (revenueRes.data ?? {}) as unknown as RevenueResult
  const prevRevenue = (prevRevenueRes.data ?? {}) as unknown as RevenueResult
  const classes     = (occupancyRes.data ?? []) as unknown as ClassOccupancy[]
  const members     = membersRes.data ?? []
  const contacts    = contactsRes.data ?? []
  const eventRegs   = (eventRegsRes.data ?? []) as { event_id: string; event_title: string; amount_paid: number; tier: string }[]
  const attendanceCount = attendanceCountRes.count ?? 0

  // ── Keuangan ──────────────────────────────────────────────────────────
  const totalRevenue     = revenue.revenue_event + revenue.revenue_class + revenue.revenue_membership + revenue.revenue_walkin
  const prevTotalRevenue = prevRevenue.revenue_event + prevRevenue.revenue_class + prevRevenue.revenue_membership + prevRevenue.revenue_walkin
  const revenueBreakdown = [
    { label: 'Kelas',      value: revenue.revenue_class },
    { label: 'Event',      value: revenue.revenue_event },
    { label: 'Membership', value: revenue.revenue_membership },
    { label: 'Walk-in',    value: revenue.revenue_walkin },
  ]
  const methodBreakdown = Object.entries(revenue.payment_method_breakdown ?? {})

  // ── Member ────────────────────────────────────────────────────────────
  const memberTotal = members.length
  const memberStatusCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1
    return acc
  }, {})
  // Member baru di PERIODE ini - WAJIB pakai created_at, BUKAN status='new'
  // (status itu live/rolling, dihitung relatif ke hari ini - lihat
  // compute_member_status migrasi 001. Untuk periode lalu, status='new'
  // akan diam-diam salah/0.)
  const memberNewThisPeriod = members.filter(m => !!m.created_at && m.created_at >= periodStart && m.created_at <= periodEndTs).length

  // ── Komunitas ─────────────────────────────────────────────────────────
  const contactTotal = contacts.length
  const contactNewThisPeriod = contacts.filter(c => !!c.created_at && c.created_at >= periodStart && c.created_at <= periodEndTs).length
  // Konversi KUMULATIF sepanjang waktu, bukan per-periode - tidak ada
  // kolom converted_at di skema, jadi "konversi bulan ini" tidak bisa
  // dihitung akurat. Tampilkan sebagai fakta lifetime, bukan periode.
  const contactConverted = contacts.filter(c => c.converted_member_id).length
  const conversionRate = contactTotal > 0 ? Math.round((contactConverted / contactTotal) * 100) : 0

  // ── Kelas ─────────────────────────────────────────────────────────────
  // Satu list gabungan (revenue + kehadiran + occupancy per baris), diurutkan
  // by-revenue - bukan 3 list terpisah seperti sebelumnya (temuan UX audit
  // T2.1: untuk studio kecil, 3 list itu cuma menampilkan kelas yang sama
  // berulang-ulang, nol insight baru).
  const classesSorted = [...classes].sort((a, b) => b.revenue - a.revenue)

  // ── Event ─────────────────────────────────────────────────────────────
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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader title="Laporan" subtitle="Kondisi bisnismu, satu halaman" />

      <PeriodNav month={month} currentMonth={currentMonth} />

      <div className="mb-4">
        <SummaryCards
          revenue={totalRevenue}
          previousRevenue={prevTotalRevenue}
          memberNew={memberNewThisPeriod}
          attendanceCount={attendanceCount}
        />
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Action Snapshot</p>
        {/* Catatan: hari ini cuma pending payment - di Sprint berikutnya akan
            bertambah (member at-risk, occupancy rendah, trial habis, dst). */}
        <p className="text-xs text-gray-400 px-1 mb-2">Hal-hal yang membutuhkan perhatian Anda</p>
        <ActionSnapshot pendingCount={revenue.pending_count ?? 0} pendingAmount={revenue.pending_amount ?? 0} />
      </div>

      {/* Keuangan */}
      <SectionList
        label="Keuangan"
        footer={totalRevenue === 0 ? `Belum ada revenue tercatat untuk ${month === currentMonth ? 'bulan ini' : 'periode ini'}.` : undefined}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-violet-50">
          <span className="text-sm font-semibold text-gray-700">Total Revenue</span>
          <span className="text-sm font-bold text-violet-700">{formatRupiah(totalRevenue)}</span>
        </div>
        {revenueBreakdown.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">{label}</span>
            <span className="text-sm font-semibold text-gray-900">{formatRupiah(value)}</span>
          </div>
        ))}
      </SectionList>

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

      {/* Member */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Member</p>
        {/* Klarifikasi eksplisit - "Member" di sini = pelanggan paket membership,
            BUKAN "siapa saja yang pernah ikut kelas/event". Tanpa ini, instruktur
            yang punya banyak peserta kelas tapi belum pakai fitur paket membership
            bisa salah baca "Member: 0" sebagai "saya tidak punya pelanggan". */}
        <p className="text-xs text-gray-400 px-1 mb-2">
          Member = pelanggan paket membership. Peserta kelas/event reguler tetap tercatat di Keuangan &amp; Kelas.
        </p>
        {memberTotal === 0 ? (
          <EmptyState
            icon={Users}
            message="Belum ada paket Member - peserta kelas/event tetap tercatat di atas"
            ctaHref="/members/new"
            ctaLabel="Tambah Member"
          />
        ) : (
          <SectionList footer="Breakdown status di atas adalah snapshot hari ini, bukan kondisi di periode yang dipilih. 'Member Baru' di kartu ringkasan di atas yang mencerminkan periode ini.">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">Total Member</span>
              <span className="text-sm font-semibold text-gray-900">{memberTotal}</span>
            </div>
            {Object.entries(memberStatusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700">
                  {MEMBER_STATUS[status as keyof typeof MEMBER_STATUS]?.label ?? status}
                </span>
                <span className="text-sm font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </SectionList>
        )}
      </div>

      {/* Komunitas */}
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

      {/* Kelas */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Kelas</p>
        {classes.length === 0 ? (
          <EmptyState icon={Calendar} message="Belum ada kelas aktif" ctaHref="/classes/new" ctaLabel="Tambah Kelas" />
        ) : (
          <ClassOccupancyList classes={classesSorted} />
        )}
      </div>

      {/* Event */}
      <div className="mt-4 mb-6">
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
    </div>
  )
}
