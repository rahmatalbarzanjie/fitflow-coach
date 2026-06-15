import Link from 'next/link'
import { Activity, Users, Calendar, BarChart3, MessageCircle, CheckCircle, Smartphone } from 'lucide-react'

const FEATURES = [
  { icon: Calendar,      title: 'Jadwal Otomatis',      desc: 'Sesi mingguan dibuat otomatis. Reschedule dan ubah lokasi langsung dari HP.' },
  { icon: Users,         title: 'Kelola Member',        desc: 'Data member lengkap, tracking kehadiran, dan deteksi member at-risk.' },
  { icon: CheckCircle,   title: 'Absensi Digital',      desc: 'Buka absensi dari HP saat kelas berlangsung. Tidak perlu kertas.' },
  { icon: MessageCircle, title: 'Notifikasi WhatsApp',  desc: 'Kirim info reschedule, kelas ekstra, dan pengingat ke member via WA.' },
  { icon: BarChart3,     title: 'Laporan Pendapatan',  desc: 'Estimasi pendapatan dan bagi hasil studio terhitung otomatis per kelas.' },
  { icon: Smartphone,    title: 'Mobile Friendly',      desc: 'Didesain untuk HP. Instruktur dan peserta bisa pakai dari mana saja.' },
]

const PLANS = [
  {
    name:    'Starter',
    price:   '99.000',
    period:  'bulan',
    color:   'border-gray-200',
    badge:   null,
    items:   ['Hingga 3 kelas aktif', 'Unlimited member', 'Absensi digital', 'Notifikasi WA', 'Laporan dasar'],
  },
  {
    name:    'Pro',
    price:   '199.000',
    period:  'bulan',
    color:   'border-violet-500',
    badge:   'Paling Populer',
    items:   ['Unlimited kelas', 'Unlimited member', 'Absensi digital', 'Notifikasi WA', 'Laporan lengkap + bagi hasil', 'AI caption generator', 'Manajemen event & pendaftaran'],
  },
]

export default function HomePage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">FitFlow Coach</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Masuk
            </Link>
            <Link
              href="/daftar"
              className="h-8 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
            >
              Coba Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <span className="inline-block text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4">
          ✨ Trial 30 hari gratis — tanpa kartu kredit
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
          Kelola Kelas Fitness<br />
          <span className="text-violet-600">Lebih Mudah dari HP</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
          Absensi digital, jadwal otomatis, notifikasi WhatsApp ke member, dan laporan pendapatan — semua dalam satu aplikasi untuk instruktur fitness Indonesia.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/daftar"
            className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-violet-200"
          >
            Daftar Sekarang — Gratis 30 Hari
          </Link>
          <Link
            href="/login"
            className="h-12 px-6 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors"
          >
            Masuk ke Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Semua yang kamu butuhkan</h2>
          <p className="text-gray-500 text-center text-sm mb-10">Dirancang khusus untuk instruktur fitness — bukan software HRD perusahaan.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Harga Transparan</h2>
          <p className="text-gray-500 text-center text-sm mb-10">Trial 30 hari gratis, batalkan kapan saja.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 p-6 ${plan.color}`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold bg-violet-600 text-white px-3 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <h3 className="font-bold text-gray-900 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-xs text-gray-400">Rp</span>
                  <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-xs text-gray-400">/{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/daftar"
                  className={`block text-center h-10 leading-10 rounded-xl text-sm font-semibold transition-colors ${
                    plan.badge
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  Mulai Trial Gratis
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            Harga belum termasuk PPN. Pembayaran bulanan. Tidak ada kontrak jangka panjang.
          </p>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="bg-violet-600 py-14">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Siap kelola kelas dengan lebih mudah?</h2>
          <p className="text-violet-200 text-sm mb-6">Daftar sekarang dan nikmati trial 30 hari gratis — tanpa kartu kredit.</p>
          <Link
            href="/daftar"
            className="inline-flex items-center h-12 px-8 bg-white text-violet-700 font-semibold rounded-xl text-sm hover:bg-violet-50 transition-colors shadow"
          >
            Daftar Sekarang →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-violet-500 rounded-md flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">FitFlow Coach</span>
          </div>
          <p className="text-xs text-gray-500">© 2026 FitFlow Coach. Dibuat untuk instruktur fitness Indonesia.</p>
          <Link href="/login" className="text-xs text-gray-400 hover:text-white transition-colors">
            Login Instruktur
          </Link>
        </div>
      </footer>
    </div>
  )
}
