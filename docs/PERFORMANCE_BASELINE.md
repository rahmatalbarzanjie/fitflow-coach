# FitFlow Performance Baseline

Diukur: 2026-06-21, sebelum modul Broadcast dibangun. Tujuan dokumen ini: jadi
titik pembanding "sebelum Broadcast vs sesudah Broadcast" - kalau performa
turun signifikan setelah Broadcast masuk (audience segment, draft campaign,
statistik tambahan), bandingkan ke angka di sini untuk tahu apakah itu
regresi atau sudah jadi karakteristik baru aplikasi.

Status: **Foundation Performance = PASS WITH KNOWN LIMITATION** (lihat
"Known limitation" di bawah). Tidak blocker untuk mulai Broadcast.

## Metodologi

- `console.time`/`console.timeEnd` di level page dan query utama (lihat
  `src/lib/perf.ts`, dipasang di `beranda`, `classes`, `members`, `community`,
  `events` page.tsx). **Instrumentasi ini sengaja dibiarkan terpasang** sampai
  Broadcast selesai, supaya bisa benchmark ulang dengan kondisi yang sama.
- `src/components/dev/RoutePerfTracker.tsx` (dipasang di
  `DashboardLayout.tsx`) - ukur waktu klik `<a>` sampai konten halaman
  tujuan ter-mount di browser, dikirim ke `/api/perf-log` supaya muncul di
  log server.
- Median dari 3-8 sampel per halaman/query (klik navigasi manual, bukan hard
  refresh, browser sudah login).

## Hasil sebelum optimasi (sampel pertama, 1x reload tiap halaman)

| Page | Waktu render server |
|---|---|
| /classes | 247ms |
| /members | 265ms |
| /community | 265ms |
| /events | 276ms |
| /beranda | 557ms (10 query Supabase paralel) |

Tidak ditemukan N+1 di halaman manapun - semua query sudah paralel
(`Promise.all`) atau embedded join PostgREST (`attendance(id)`,
`registrations(id,...)`).

## Optimasi yang dilakukan

1. **Auth ganda dihilangkan** - setiap page Server Component memanggil
   `supabase.auth.getUser()` sendiri (network call ke Supabase Auth),
   padahal `middleware.ts` sudah memanggilnya untuk request yang sama.
   Diganti ke `supabase.auth.getSession()` (baca cookie lokal, tanpa
   network call) di 5 page. Aman karena RLS tetap melindungi data
   terlepas dari nilai `user.id` yang dipakai di query - bukan
   `getUser()`/`getSession()` yang jadi gerbang keamanan, middleware yang
   sudah memvalidasi sesi untuk request ini.
   - Trade-off: Supabase SDK memunculkan warning di log server
     ("could be insecure, use getUser() instead") setiap `getSession()`
     dipanggil server-side. **Belum technical-debt-free** - solusi jangka
     panjang yang lebih bersih (middleware menitipkan `user.id` lewat
     request header, page baca header tanpa panggil Auth API sama sekali)
     sudah didesain tapi belum dikerjakan. Lakukan sebelum production
     kalau warning ini dianggap mengganggu/berisiko.
2. **Dashboard aggregate query** - `supabase/migrations/029_dashboard_summary.sql`,
   RPC `get_dashboard_summary(p_user_id, p_month_start)` menggabungkan
   4 query (`attendanceMonth`, `memberNew`, `revenueMonth`, `eventsPending`)
   jadi 1 round-trip. `/beranda` turun dari 10 query jadi 7.
3. **Cache 45 detik** untuk data dashboard yang tidak real-time (profil,
   daftar kelas, member at-risk, event mendatang, undangan komunitas
   pending, ringkasan bulan ini) lewat `unstable_cache` (lihat
   `getCachedBerandaData` di `beranda/page.tsx`), pakai service-role client
   + filter manual `user_id` (bukan RLS, karena cache bisa disajikan lintas
   request). `todaySessions` (kehadiran hari ini) **sengaja tidak di-cache**
   - itu satu-satunya data yang harus selalu fresh karena instruktur cek
     dashboard tepat setelah absen.

## Hasil sesudah optimasi (median, 3-8 sampel)

| Page | Median | Min | Max | Target | Status |
|---|---|---|---|---|---|
| /classes | 157ms | 144 | 293 | <200ms | PASS |
| /members | 202ms | 134 | 245 | <200ms | pas di batas |
| /events | 325ms | 177 | 359 | <200ms | belum tercapai |
| /community | 675ms | 309 | 1040 | <200ms | belum tercapai, varians ekstrem |
| /beranda | 406ms | 145 | 712 | <300ms | belum tercapai, turun dari 557ms |

`query:/beranda:cached-bundle` (profile+classes+atRisk+events+invitations+summary
gabungan) median **3ms** dari 8 sampel - cache bekerja sesuai desain.
`todaySessions` (tidak di-cache) median **364ms** - sekarang ini bottleneck
utama `/beranda`, bukan lagi jumlah query atau auth ganda.

## Known limitation: latensi Supabase fluktuatif

`/community` - query yang sama, kode yang sama, halaman yang sama:
309ms di satu sampel, 1040ms di sampel lain (selisih 731ms). Tidak ada
penjelasan di sisi frontend/Next.js untuk selisih ini - ciri khas network
latency / connection pooling / kemungkinan region mismatch antara
Vercel dan Supabase, bukan bug aplikasi.

**Ini bukan blocker** - fondasi arsitektur (tidak ada N+1, query paralel,
auth tidak ganda, cache bekerja, App Router prefetch bekerja) sudah sehat.
Sisa masalah ada di lapisan network/infrastruktur, bukan kode.

## Temuan tambahan: App Router prefetch menyembunyikan sebagian besar latensi

Navigasi via klik menu (bukan reload) ke halaman yang link-nya sudah
terlihat di viewport: **10-42ms** (terasa instan, karena Next.js sudah
prefetch RSC payload di background sebelum diklik). Navigasi pertama ke
suatu halaman (atau setelah cold start/restart server): **800ms-2.5 detik**.
Pengalaman "klik → loading 1-2 detik" yang dirasakan kemungkinan besar
adalah skenario kunjungan pertama/cold start, bukan representasi pemakaian
normal sehari-hari (instruktur bolak-balik antar menu yang sama).

## Belum dikerjakan - untuk SEBELUM production launch, bukan sekarang

**Audit region Vercel vs region Supabase.** Kalau keduanya tidak satu
region (mis. Vercel di Singapore, Supabase di US East atau sebaliknya),
itu bisa menjelaskan ratusan milidetik latensi per query yang terlihat di
atas. Ini satu-satunya area performa yang masih layak diselidiki sebelum
launch produksi - belum dikerjakan di sprint ini.

## Keputusan

Audit dan sprint performa dihentikan di titik ini (2026-06-21). Tidak ada
refactor dashboard/query/cache lebih lanjut - risiko mengubah lagi sudah
lebih besar daripada manfaatnya. Lanjut ke audit modul Broadcast.
