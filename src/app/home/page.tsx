import Link from 'next/link'
import { Activity, Users, Calendar, BarChart3, MessageCircle, CheckCircle, Smartphone, Sparkles, Wrench } from 'lucide-react'
import { PricingSection } from '@/components/home/PricingSection'
import { ScrollReveal } from '@/components/public/ScrollReveal'
import { getSystemConfig } from '@/lib/system-config'

// Status toggle (home_page_enabled) bisa diubah admin kapan saja — paksa
// render per-request, jangan di-cache statis saat build.
export const dynamic = 'force-dynamic'

const FEATURES = [
  { icon: Calendar,      title: 'Jadwal Otomatis',      desc: 'Sesi mingguan dibuat otomatis. Reschedule dan ubah lokasi langsung dari HP.' },
  { icon: Users,         title: 'Kelola Member',        desc: 'Data member lengkap, tracking kehadiran, dan deteksi member at-risk.' },
  { icon: CheckCircle,   title: 'Absensi Digital',      desc: 'Buka absensi dari HP saat kelas berlangsung. Tidak perlu kertas.' },
  { icon: MessageCircle, title: 'Notifikasi WhatsApp',  desc: 'Kirim info reschedule, kelas ekstra, dan pengingat ke member via WA.' },
  { icon: Sparkles,      title: 'AI Bot & Caption',     desc: 'Bot WA otomatis jawab pertanyaan calon member, plus AI bantu buat caption konten.' },
  { icon: BarChart3,     title: 'Laporan Pendapatan',  desc: 'Estimasi pendapatan dan bagi hasil studio terhitung otomatis per kelas.' },
  { icon: Smartphone,    title: 'Mobile Friendly',      desc: 'Didesain untuk HP. Instruktur dan peserta bisa pakai dari mana saja.' },
]

const FAQ = [
  {
    q: 'Trial 30 hari itu dapat akses apa aja?',
    a: 'Semua fitur, tanpa batas — kelas, event, member, broadcast WA, AI caption generator, AI bot WA. Tidak ada yang dikunci selama trial. Tidak perlu kartu kredit.',
  },
  {
    q: 'Kalau kuota kelas aktif atau broadcast WA bulanan sudah penuh, gimana?',
    a: 'Sistem akan kasih tahu dan arahkan untuk upgrade paket — data kamu tidak hilang, tinggal pilih paket dengan kuota lebih besar.',
  },
  {
    q: 'Bisa ganti paket kapan saja?',
    a: 'Bisa, kapan saja, naik atau turun paket. Tinggal hubungi tim kami via WhatsApp.',
  },
  {
    q: 'Pembayaran lewat apa?',
    a: 'Transfer bank manual, dicatat oleh tim kami begitu pembayaran masuk. Tidak ada kontrak jangka panjang.',
  },
]

export default async function HomePage() {
  const enabledFlag = await getSystemConfig('home_page_enabled')
  const isEnabled = enabledFlag !== 'false'

  if (!isEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-100 rounded-2xl mb-5">
            <Wrench className="w-8 h-8 text-violet-500" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 bg-violet-600 rounded-lg flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">FitFlow Coach</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sedang Dalam Tahap Pengembangan</h1>
          <p className="text-sm text-gray-500 mb-6">
            Halaman ini sedang kami persiapkan. Sudah jadi pelanggan? Masuk ke dashboard kamu di bawah.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-11 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Masuk ke Dashboard
          </Link>
        </div>
      </div>
    )
  }

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
            <Link href="#pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Harga
            </Link>
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
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: 'linear-gradient(160deg, #F5F3FF 0%, #FFFFFF 55%)' }}
        />
        <div className="absolute top-10 right-0 w-72 h-72 bg-violet-200/40 rounded-full blur-3xl -z-10" />
        <div className="absolute top-40 left-0 w-64 h-64 bg-pink-200/30 rounded-full blur-3xl -z-10" />
        <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-full mb-5">
            ✨ Trial 30 Hari — Akses Semua Fitur, Tanpa Kartu Kredit
          </span>
          <h1 className="font-montserrat text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Kelola Kelas Fitness<br />
            <span className="text-violet-600">Lebih Mudah dari HP</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
            Absensi digital, jadwal otomatis, notifikasi WhatsApp ke member, AI bot WA, dan laporan pendapatan — semua dalam satu aplikasi untuk instruktur fitness Indonesia.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/daftar"
              className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-violet-200 hover:scale-105"
            >
              Daftar Sekarang — Gratis 30 Hari
            </Link>
            <Link
              href="/login"
              className="h-12 px-6 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 rounded-xl font-medium text-sm transition-colors"
            >
              Masuk ke Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <ScrollReveal><div className="max-w-5xl mx-auto px-4">
          <h2 className="font-montserrat text-2xl font-bold text-gray-900 text-center mb-2">Semua yang kamu butuhkan</h2>
          <p className="text-gray-500 text-center text-sm mb-10">Dirancang khusus untuk instruktur fitness — bukan software HRD perusahaan.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-5 border border-gray-100 hover-lift transition-all">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div></ScrollReveal>
      </section>

      {/* Pricing */}
      <ScrollReveal><PricingSection /></ScrollReveal>

      {/* FAQ */}
      <section className="bg-gray-50 py-16">
        <ScrollReveal><div className="max-w-2xl mx-auto px-4">
          <h2 className="font-montserrat text-2xl font-bold text-gray-900 text-center mb-10">Pertanyaan yang Sering Ditanyakan</h2>
          <div className="space-y-3">
            {FAQ.map(item => (
              <details key={item.q} className="bg-white rounded-2xl border border-gray-100 p-5 group">
                <summary className="text-sm font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none shrink-0 ml-3">+</span>
                </summary>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div></ScrollReveal>
      </section>

      {/* CTA Bottom */}
      <section className="bg-violet-600 py-14">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="font-montserrat text-2xl font-bold text-white mb-3">Siap kelola kelas dengan lebih mudah?</h2>
          <p className="text-violet-200 text-sm mb-6">Daftar sekarang dan nikmati trial 30 hari gratis — akses semua fitur, tanpa kartu kredit.</p>
          <Link
            href="/daftar"
            className="inline-flex items-center h-12 px-8 bg-white text-violet-700 font-semibold rounded-xl text-sm hover:bg-violet-50 transition-colors shadow hover:scale-105"
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
