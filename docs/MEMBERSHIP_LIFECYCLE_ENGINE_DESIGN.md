# Membership Lifecycle Engine — Design Document

**Tanggal**: 2026-06-28
**Status**: Desain arsitektur murni. TIDAK ADA kode/migrasi/trigger/RPC dibuat dari dokumen ini.
**Konteks**: Master UAT seluruh 10 modul + Laporan V2 Sprint 1 sudah selesai. Audit lama menandai "Membership Lifecycle Engine" sebagai 1 item P1, ditunda sampai semua modul diaudit — sekarang sudah waktunya dibahas, dipicu kebutuhan nyata: migrasi member lama CAREA (paket 6 sesi, sudah berjalan, sisa 4 sesi, uang diterima sebelum FitFlow dipakai).

---

## 0. Fakta Implementasi Saat Ini (diverifikasi langsung ke kode, bukan asumsi)

- `membership_packages` (katalog) dan `member_memberships` (instansi per member) sudah ada, skema dasar sehat (snapshot harga, RLS benar, unique constraint 1 membership aktif per member).
- `member_memberships.used_sessions` ada di skema, **tidak pernah di-update oleh kode atau trigger apa pun** — selamanya 0 sejak insert. Fitur "Sisa X/Y sesi" yang sudah tertulis di UI (`members/[id]/membership/page.tsx`) menampilkan angka yang TIDAK PERNAH benar untuk member yang sudah hadir.
- `attendance` **tidak punya kolom referensi ke `member_memberships` sama sekali** — tidak ada cara mengetahui sesi attendance mana yang seharusnya mengurangi paket mana. Konsumsi sesi benar-benar belum dimodelkan, bukan cuma "belum dihitung otomatis".
- Revenue Membership (di `get_dashboard_summary` dan `get_laporan_revenue`) dihitung dari `SUM(purchase_price) WHERE purchase_price > 0 AND created_at IN periode` — **tidak ada mekanisme exclude** apa pun. Memasukkan member legacy hari ini = otomatis nambah revenue periode ini, sesuai kekhawatiran yang memicu dokumen ini.
- `revenue_share_pct` cuma ada di tabel `classes` (dipakai form "Bagi Hasil" kelas) — **nol existing logic** untuk bagi hasil membership.
- `AssignPackageForm.tsx` tidak punya field untuk mengisi "sudah terpakai berapa sesi" — satu-satunya cara migrasi member legacy hari ini adalah edit database langsung.

Semua temuan di atas mengonfirmasi: kekhawatiran yang memicu dokumen ini bukan hipotesis, tapi gap implementasi yang nyata.

---

## 1. Prinsip Arsitektur yang Dikunci

> **Penjualan paket membership, kepemilikan hak pakai, dan konsumsi sesi adalah TIGA kejadian bisnis berbeda yang harus bisa eksis secara independen — terutama karena Ownership BISA ada tanpa Sale (kasus legacy).**

Turunan langsung dari prinsip ini:

1. **Revenue Recognition dan Revenue Sharing adalah 2 layer terpisah**, dievaluasi pada basis yang BISA berbeda (cash-basis untuk recognition, consumption-basis untuk sharing) — lihat §F.
2. **`remaining_sessions` tidak pernah disimpan sebagai angka yang di-mutasi** — selalu dihitung dari `total_sessions - count(konsumsi aktif)`. Ini bukan preferensi gaya, ini PERBAIKAN LANGSUNG dari bug yang sudah dikonfirmasi (`used_sessions` yang permanen 0).
3. **Legacy Ownership tidak pernah dipaksa punya Sale record yang masuk hitungan revenue.** Tidak ada "flag pengecualian" yang bisa lupa di-set — ketidakhadiran Sale yang revenue-recognized SECARA STRUKTURAL berarti tidak ada revenue, bukan exception yang harus diingat-ingat.
4. **Konsumsi sesi adalah ledger append-only**, bukan counter yang di-decrement. Pembatalan/koreksi = entri pembalik baru, bukan menghapus/mengedit entri lama. Ini konsisten dengan pola yang SUDAH dipegang di seluruh aplikasi (`cancelled_at` tidak menghapus `confirmed_at`, dst — histori finansial tidak pernah dihapus, cuma ditambah status baru).
5. **Setiap entitas tetap di-scope ke satu instruktur (`user_id`)** — tidak ada asumsi baru yang mengunci single-instructor, konsisten dengan prinsip yang sudah dipegang di Laporan V2 (tulis semua logic ber-parameter satu entitas, agregasi lintas-instruktur adalah lapisan terpisah nanti).
6. **Titik pemotongan sesi HANYA satu: kehadiran yang benar-benar tercatat (`attendance`), tidak pernah di titik booking/registrasi.** Membuat `registrations` (booking/daftar) atau status "akan datang" TIDAK BOLEH mengurangi sesi — kalau booking dibatalkan setelah sesi sudah dipotong duluan, paket bocor (member dirugikan, kuota hilang tanpa pernah benar-benar hadir). Konsumsi cuma terjadi saat baris `attendance` benar-benar dibuat (instruktur mencatat member hadir), bukan lebih awal dari itu. Ini secara struktural sudah konsisten dengan pemisahan `registrations` (niat/booking) vs `attendance` (kehadiran nyata) yang sudah ada di aplikasi — prinsip ini menjadikannya eksplisit, bukan kebetulan tersirat dari pilihan tabel.

---

## 2. Domain Model

### A. Lima Konsep, Tanggung Jawab Masing-Masing

| Konsep | Pertanyaan yang dijawab | Kapan terjadi |
|---|---|---|
| **Membership Sale** | "Apakah ada transaksi uang, dan apakah itu uang FitFlow?" | Sekali, di titik waktu pembelian (atau tidak ada sama sekali untuk legacy) |
| **Membership Ownership** | "Apa yang member ini BERHAK pakai, dan sampai kapan?" | Berlangsung dari `start_date` sampai `end_date` (atau tanpa batas) |
| **Membership Consumption** | "Sesi mana yang sudah benar-benar dipakai?" | Berulang, satu entri per kehadiran yang mengurangi hak pakai |
| **Revenue Recognition** | "Apakah transaksi ini dihitung sebagai revenue FitFlow?" | Properti dari Sale (ada/tidak ada Sale yang revenue-recognized) |
| **Revenue Sharing** | "Dari revenue yang diakui, instruktur dapat berapa?" | Bisa dihitung di titik Sale ATAU titik Consumption (lihat §F) |

### B. Kenapa Sale dan Ownership HARUS Bisa Berdiri Sendiri

Ini bukan preferensi desain — ini dipaksa oleh kasus CAREA. Member A punya **Ownership** (sisa 4 dari 6 sesi) tapi TIDAK punya **Sale** di dunia FitFlow (uangnya diterima di luar sistem, sebelum FitFlow ada). Kalau Sale dan Ownership dipaksa jadi satu baris yang sama (seperti `member_memberships` hari ini), satu-satunya cara merepresentasikan ini adalah membuat Sale palsu (bug revenue) atau tidak ada cara sama sekali memasukkan member ini ke sistem dengan benar.

### C. Diagram Domain (sederhana, konsep — bukan skema fisik)

```
                    ┌─────────────────────┐
                    │  Membership Package │   (katalog: 6 sesi / unlimited / dst)
                    │  (sudah ada)        │
                    └──────────┬──────────┘
                               │ referensi
                               ▼
   ┌───────────────┐   ┌─────────────────────┐
   │ Membership     │  │  Membership          │
   │ Sale           │◄─┤  Ownership            │   total_sessions (snapshot)
   │                │  │                       │   start_date / end_date
   │ source:        │  │  (member memegang     │   status
   │  fitflow|legacy│  │   hak pakai ini)       │
   │ recognized:    │  └──────────┬────────────┘
   │  true|false    │             │ 1 ownership punya
   │ purchase_price │             │ banyak entri konsumsi
   └────────────────┘             ▼
                         ┌──────────────────────┐
                         │ Consumption Ledger    │   append-only
                         │ (entri per kehadiran)  │   reversed_at nullable
                         │ → referensi attendance │   (bukan delete)
                         └──────────┬─────────────┘
                                    │ tiap entri TAHU
                                    │ kelas/instruktur mana
                                    ▼
                         ┌──────────────────────┐
                         │ Revenue Sharing        │   dihitung dari Sale
                         │ (instruktur vs studio) │   ATAU dari Consumption
                         └──────────────────────┘   (lihat §F - belum dikunci)

   remaining_sessions = Ownership.total_sessions − COUNT(Consumption WHERE reversed_at IS NULL)
   (SELALU dihitung, TIDAK PERNAH disimpan sebagai counter)
```

**Catatan penting**: Sale dan Ownership digambar sebagai 2 kotak terpisah, tapi untuk kasus NORMAL (bukan legacy) keduanya dibuat BERSAMAAN dalam satu aksi user ("assign package ke member") — secara fisik BISA tetap 1 tabel dengan kedua tanggung jawab itu hidup di baris yang sama, SELAMA ada cara eksplisit untuk Ownership punya Sale yang `recognized: false` ATAU tidak punya Sale yang nyata-nyata mewakili uang masuk. Pemisahan konseptual ini WAJIB ada secara LOGIKA, tidak otomatis berarti harus jadi 2 tabel fisik — itu keputusan implementasi nanti, bukan keputusan desain di dokumen ini.

---

## 3. Source of Truth (§B)

| Pertanyaan | Jawaban |
|---|---|
| Sumber kebenaran **total sesi** | Snapshot di Ownership saat dibuat (dari `package.total_sessions` waktu itu) — pola yang SUDAH BENAR hari ini (`purchase_price` juga sudah snapshot, prinsip yang sama tinggal diperluas) |
| Sumber kebenaran **sesi terpakai** | **COUNT dari Consumption Ledger yang belum dibalik** (`reversed_at IS NULL`) — TIDAK PERNAH angka yang disimpan/di-decrement |
| Apakah `remaining_sessions` perlu disimpan? | **TIDAK.** Selalu dihitung: `total_sessions − used`. Inilah perbaikan langsung atas bug `used_sessions` yang permanen 0 — kalau dihitung, mustahil "lupa update", karena tidak ada apa pun untuk di-update |
| Bagaimana attendance memengaruhi membership? | Setiap attendance yang memenuhi syarat (member punya Ownership aktif yang cocok tipe kelasnya) otomatis membuat TEPAT SATU entri Consumption, mereferensikan attendance itu. Attendance dibatalkan → entri Consumption terkait dibalik (bukan dihapus) |

---

## 4. Legacy Migration (§C)

### Kasus CAREA, konkret

**Member A** — paket 6 sesi, sisa 4 (artinya sudah pakai 2), uang diterima sebelum FitFlow:

1. Buat **Ownership**: `total_sessions = 6`, `start_date` = tanggal beli aslinya (kalau diketahui) atau tanggal migrasi, `status = active`.
2. Buat **Sale** dengan `source = legacy`, `purchase_price = 360000` (TETAP DICATAT untuk histori/riwayat pembelian member — bukan dihilangkan, cuma ditandai), `recognized_as_revenue = false`.
3. Buat **2 entri Consumption** mewakili 2 sesi yang sudah terpakai SEBELUM migrasi — entri ini TIDAK PERLU terhubung ke baris `attendance` yang nyata (kehadiran itu terjadi sebelum sistem ada) — referensi attendance jadi NULLABLE khusus untuk kasus ini, dengan catatan teks "Migrasi data lama, tidak terhubung ke sesi spesifik".

Hasil: `remaining = 6 − 2 = 4` ✅ benar, **revenue periode ini TIDAK bertambah** ✅ karena query revenue cuma melihat Sale dengan `recognized_as_revenue = true`.

### Konsep Eksplisit yang Dibutuhkan

Field `source` pada Sale: `'fitflow' | 'legacy'`. Ini SATU-SATUNYA tempat keputusan "apakah ini uang FitFlow" diambil — tidak tersebar ke banyak tempat, tidak ada logika tersembunyi.

---

## 5. Revenue Model (§D)

**Prinsip yang sudah dikunci sebelumnya (Revenue Settlement, untuk Registrasi Kelas/Event)**: revenue = uang yang PERNAH dikonfirmasi diterima, fakta historis berbasis `confirmed_at`, bukan status saat ini.

**Perluasan untuk Membership, konsisten dengan prinsip itu**: revenue Membership = `SUM(purchase_price)` dari Sale dengan `source = 'fitflow'` **DAN** (kalau diadopsi — lihat catatan di bawah) `recognized_at IS NOT NULL`.

- **Kapan revenue diakui**: saat Sale dengan `source = 'fitflow'` dibuat (untuk V1 — anggap selalu "confirmed" di titik input, sama seperti perilaku `member_memberships` hari ini yang tidak punya status pending).
- **Kapan revenue TIDAK diakui**: `source = 'legacy'` — titik, tidak ada pengecualian lain di V1.
- **Gap konsistensi yang perlu diputuskan terpisah (bukan blocker untuk migrasi CAREA)**: Registrasi Kelas/Event punya status `pending → confirmed`, Membership Sale hari ini tidak punya konsep itu sama sekali (selalu langsung "lunas" begitu di-input instruktur). Untuk konsistensi penuh dengan prinsip Revenue Settlement, Membership Sale SEBAIKNYA juga punya `payment_status`/`confirmed_at` sendiri (mis. instruktur catat penjualan tapi belum terima transfer). **Ini didokumentasikan sebagai keputusan terbuka, BUKAN syarat wajib untuk migrasi legacy** — migrasi CAREA cuma butuh field `source`, tidak butuh `payment_status` baru.

---

## 6. Attendance Deduction Engine (§E)

**Titik pemotongan tunggal (Prinsip #6, §1)**: HANYA `attendance` yang memotong sesi. `registrations` (booking/daftar/niat hadir) TIDAK PERNAH memotong, berapa pun statusnya (pending/confirmed/menunggu) — kalau booking dipotong duluan lalu dibatalkan, paket bocor diam-diam. Tabel di bawah ini semua berputar di sekitar `attendance` sebagai satu-satunya pemicu.

| Skenario | Penanganan |
|---|---|
| **Booking/Registrasi dibuat (status apa pun)** | ❌ Tidak memotong sesi sama sekali — ini cuma niat/janji hadir, belum kejadian nyata |
| **Attendance baru dibuat** | Kalau member punya Ownership aktif yang cocok (tipe kelas sesuai, atau package `class_type = NULL` = semua kelas) → buat 1 entri Consumption, status aktif |
| **Attendance dibatalkan/dihapus** | Entri Consumption terkait DIBALIK (`reversed_at` diisi), TIDAK dihapus — `remaining` otomatis kembali karena query cuma hitung yang belum dibalik |
| **Attendance diedit** (mis. salah kelas/sesi) | Pola "balik lalu buat baru" — bukan edit in-place. Entri Consumption lama dibalik, entri baru dibuat untuk attendance yang sudah benar. Konsisten dengan prinsip "ledger append-only" di §1 |
| **Member pindah kelas** | Kalau package `class_type = NULL` (semua kelas) → bukan masalah, konsumsi jalan normal di kelas apa pun. Kalau package terikat 1 tipe kelas spesifik dan member hadir di tipe LAIN → **keputusan bisnis terbuka, bukan keputusan teknis**: apakah ditolak (jatuh ke harga OTS biasa) atau instruktur bisa override manual? Direkomendasikan: tolak otomatis + tawarkan override manual, supaya tidak ada kebocoran diam-diam |
| **Double attendance** (member ditandai hadir 2x di sesi yang sama) | Sudah dicegah di level `attendance` itu sendiri (constraint unique `session_id + member_id` sudah ada hari ini) — Consumption ledger otomatis ikut terlindungi karena 1 attendance = 1 entri Consumption |
| **Rollback umum** | Tidak ada hard-delete di ledger ini, selamanya. Audit trail = bisa lihat kapan sesi dipakai, kapan dibalik, dan kenapa (kolom catatan) |

---

## 7. Revenue Sharing — Analisis Tanpa Formula Final (§F)

Tiga arah, dengan trade-off masing-masing — **tidak ada yang dipilih sebagai final di dokumen ini**:

### Opsi 1 — Share di titik Sale (lump sum saat beli)
- ✅ Sederhana, sama persis dengan model `revenue_share_pct` kelas yang sudah ada.
- ❌ Tidak adil secara waktu — member beli tapi belum datang, instruktur belum kerja, tapi bagi hasil sudah cair (persis kekhawatiran yang diajukan).
- ❌ Tidak punya jawaban jelas untuk package yang `class_type = NULL` (dipakai lintas instruktur/tipe kelas) — bagi hasil ke siapa di titik beli, kalau belum tahu kelas mana yang akan dipakai?

### Opsi 2 — Share di titik Consumption (per sesi terpakai)
- ✅ Adil secara waktu — instruktur dapat kredit pas sesi benar-benar diberikan.
- ✅ Menjawab kasus multi-tipe-kelas secara natural — tiap entri Consumption tahu PERSIS kelas/instruktur mana yang dipakai, ambil `revenue_share_pct` dari KELAS SPESIFIK itu, bukan satu angka tetap di level membership.
- ❌ Mengubah makna "Revenue Bulan Ini" jadi dua basis berbeda dalam satu produk: Keuangan/Laporan tetap cash-basis (uang masuk saat Sale), tapi nilai yang "direalisasi" untuk bagi hasil baru muncul belakangan, kadang berbulan-bulan kemudian (package tanpa masa berlaku bisa dipakai pelan-pelan). Ini KONSEKUENSI yang harus disadari, bukan otomatis cacat.

### Opsi 3 — Dua Layer Terpisah (Recognition tetap cash-basis, Sharing dihitung dari Consumption)
- Ini bukan opsi ketiga yang berdiri sendiri — ini **cara menjalankan Opsi 2 tanpa mengacaukan definisi Revenue yang sudah dikunci**. Total Revenue (apa yang dilihat Laporan/Keuangan) tetap diakui penuh di titik Sale (konsisten dengan §5) — tapi Instructor Payout (apa yang dihitung untuk dibayarkan ke instruktur) dihitung independen, progresif, dari Consumption Ledger.
- Dua angka berbeda untuk dua tujuan berbeda: **"Berapa uang masuk ke studio"** (cash, langsung) vs **"Berapa yang harus dibayar ke instruktur"** (progresif, sesuai kerja yang sudah dilakukan). Ini DIBOLEHKAN beda basis — bukan inkonsistensi, karena menjawab pertanyaan yang berbeda.

**Arah yang condong direkomendasikan (bukan keputusan final, sesuai instruksi)**: Opsi 2/3 — alasan utama bukan cuma "lebih adil", tapi karena ini SATU-SATUNYA opsi yang konsisten dengan kebutuhan Studio Readiness (§8) untuk package multi-instruktur/multi-tipe-kelas.

---

## 8. Studio Readiness (§G)

Dicek satu per satu, tidak ada asumsi yang mengunci single-instructor/single-class-type:

- Semua entitas (Sale, Ownership, Consumption) tetap di-scope per `user_id` (instruktur) — sama seperti SEMUA tabel lain di aplikasi ini hari ini. Studio mode nanti = layer agregasi DI ATAS entitas yang sudah ber-scope benar, bukan redesain entitas ini.
- Package dengan `class_type = NULL` (lintas tipe kelas) SUDAH ada di skema hari ini — desain Consumption Ledger (§2, §7 Opsi 2) sengaja dirancang supaya package ini bisa dipakai di kelas instruktur MANA PUN tanpa masalah, karena atribusi instruktur/revenue-share terjadi PER SESI (di titik Consumption), bukan ditebak di muka (di titik Sale).
- **Satu pertanyaan terbuka yang sengaja TIDAK dijawab dokumen ini**: kalau Studio mode nanti benar-benar ada, apakah katalog Package jadi milik Studio (dipakai semua instruktur) atau tetap milik 1 instruktur? Ini keputusan produk yang menyentuh `membership_packages.user_id`, di luar scope migrasi legacy yang memicu dokumen ini — dicatat sebagai pertanyaan terbuka untuk dokumen Studio Architecture terpisah nanti, bukan diputuskan sekarang.

---

## 9. Alternatif Desain yang Dipertimbangkan (dan kenapa tidak dipilih sebagai rekomendasi utama)

| Alternatif | Kenapa tidak direkomendasikan |
|---|---|
| **Tetap simpan `used_sessions` sebagai counter, tapi tambah trigger attendance untuk update otomatis** | Memperbaiki SIMPTOM (counter yang tidak ter-update), bukan AKAR masalah (counter yang bisa drift dari kenyataan kalau ada edit/cancel/rollback). Trigger increment/decrement rawan duplikat-bug yang sama kalau ada path lain yang lupa dipanggil (persis seperti bug `used_sessions` hari ini — table sudah ada, cuma logiknya yang lupa ditulis di salah satu path). Consumption Ledger yang dihitung ulang setiap saat tidak punya kelas bug ini sama sekali. |
| **Pakai 1 boolean `is_legacy` langsung di tabel `member_memberships`, tanpa pisah konsep Sale/Ownership** | Lebih cepat diimplementasi, tapi tidak menjawab kebutuhan jangka panjang Studio Readiness (§8) dan Revenue Sharing per-konsumsi (§7) — boolean ini cuma menutup 1 gap (revenue legacy), tidak membuka jalan untuk gap berikutnya (bagi hasil per sesi). Disebut di sini supaya jelas trade-off-nya: ini adalah "Quick Fix", bukan "Lifecycle Engine" yang diminta. |
| **Revenue Sharing dihitung dari Sale (Opsi 1 di §7) demi konsistensi penuh dengan model kelas** | Konsisten secara estetika dengan `classes.revenue_share_pct`, tapi gagal di kasus package lintas-tipe-kelas/instruktur yang SUDAH ada di skema (`class_type = NULL`) — bukan cuma soal "kurang adil", tapi benar-benar tidak punya jawaban teknis untuk "instruktur mana yang dapat bagian" di titik penjualan. |

---

## 10. Rekomendasi Final

1. **Pisahkan Sale dari Ownership secara LOGIKA** (boleh tetap 1 tabel fisik di V1, asal field `source`/`recognized_as_revenue` ada dan jadi satu-satunya sumber keputusan revenue).
2. **Hapus konsep `used_sessions` sebagai stored counter** — ganti total dengan Consumption Ledger yang dihitung ulang tiap kali dibutuhkan.
3. **Migrasi CAREA**: `source = legacy`, `recognized_as_revenue = false`, plus entri Consumption backdated untuk sesi yang sudah terpakai (attendance_id nullable untuk kasus ini).
4. **Revenue Sharing**: condong ke arah Consumption-basis (Opsi 2/3 di §7), TAPI ini keputusan yang belum perlu dikunci sekarang — bisa ditunda sampai ada kebutuhan nyata bagi hasil membership muncul (saat ini revenue sharing membership memang belum ada sama sekali, jadi menunda tidak merusak apa pun yang sudah berjalan).
5. **Payment status untuk Membership Sale** (pending/confirmed seperti Registrasi) — dicatat sebagai gap konsistensi, BUKAN syarat untuk migrasi legacy. Bisa ditunda.

---

## 11. Roadmap Implementasi Bertahap

### Tahap 1 — Wajib untuk migrasi CAREA (paling mendesak)
- Tambah konsep `source` (`fitflow`/`legacy`) + `recognized_as_revenue` ke Sale.
- Update query revenue (Beranda + Laporan) untuk filter `recognized_as_revenue = true`.
- Tambah field di form assign-package untuk input "sudah terpakai berapa sesi" (khusus alur legacy/migrasi).

### Tahap 2 — Consumption Ledger (memperbaiki bug `used_sessions`)
- Bangun ledger konsumsi append-only, hubungkan ke attendance (nullable untuk entri migrasi).
- Ganti semua tempat yang membaca `used_sessions` jadi membaca hasil hitung dari ledger.
- Implementasikan penanganan cancel/edit attendance → reverse-entry, BUKAN edit in-place.

### Tahap 3 — Revenue Sharing Membership (baru dikerjakan kalau benar-benar dibutuhkan)
- Putuskan basis final (Sale vs Consumption) — idealnya divalidasi dulu lewat percakapan nyata dengan instruktur yang punya kebutuhan ini, bukan diputuskan di atas meja.
- Kalau Consumption-basis dipilih: setiap entri Consumption ambil `revenue_share_pct` dari kelas spesifik yang dipakai.

### Tahap 4 — Payment status untuk Membership Sale (konsistensi, bukan urgent)
- Tambah `payment_status`/`confirmed_at` ke Sale, sejalan dengan pola Registrasi - cuma kalau ada kebutuhan nyata "instruktur catat penjualan tapi uang belum benar-benar masuk".

### Future — Studio Readiness
- Putuskan kepemilikan katalog Package (per-instruktur vs per-studio) saat Studio mode benar-benar mulai dirancang — di luar scope dokumen ini.
