# Platform Admin Panel Architecture Audit

**Tanggal**: 2026-06-30
**Status**: Audit & desain arsitektur — TIDAK ADA kode/migrasi/UI yang dibuat dari dokumen ini. Murni untuk pengambilan keputusan sebelum implementasi.
**Scope eksplisit**: model bisnis tetap 1 akun = 1 bisnis instruktur. Studio Mode, multi-instruktur, payroll, revenue sharing, marketplace, instructor login TIDAK didesain di sini.

---

## 0. Temuan Pembuka: Panel Admin Sudah Ada — Ini Bukan Membangun dari Nol

Sebelum mendesain apa pun, penting digarisbawahi: **`/admin` sudah eksis dan sudah dipakai**. Dokumen ini adalah audit + roadmap untuk **mengevolusi** panel yang sudah berjalan menjadi SaaS Control Center, bukan membangun dari kosong.

Yang sudah ada hari ini (`src/app/(dashboard)/admin/`):

| Halaman | Isi |
|---|---|
| `/admin` | Stat cards (Total, Trial, Aktif, Habis, Pendapatan Langganan Bulan Ini), antrian pendaftaran instruktur baru, antrian permintaan tautan bot WA, status device fallback platform |
| `/admin/instructors` | List semua instruktur — search, filter pills (Semua/Aktif/Trial/Habis/Bot WA belum setup), badge trial countdown, badge status bot WA |
| `/admin/[profileId]` | Detail 1 instruktur — info akun, status bot WA, stat (kelas aktif/member/sesi/estimasi revenue), daftar kelas, sesi terbaru, riwayat pembayaran, kelola trial/plan, impersonate, hapus akun |
| `/admin/classes`, `/admin/events`, `/admin/members`, `/admin/broadcasts`, `/admin/community` | Ada (belum diaudit detail isinya — di luar fokus dokumen ini) |
| `/admin/config` | Editor `system_config` |

API yang sudah ada (`src/app/api/admin/`): `record-payment`, `set-plan`, `extend-trial`, `impersonate`, `confirm-request`, `reject-request`, `delete-instructor`, `config`.

**Gating saat ini**: `user?.email !== process.env.ADMIN_EMAIL` di setiap halaman/route — bukan berbasis role. Kolom `profiles.is_platform_admin` (migrasi 025) **sudah ada di skema tapi tidak dipakai untuk gating UI/RLS**, hanya disebut di satu tempat (routing webhook WA masuk). Ini gap yang perlu dicatat (lihat §F).

Implikasi untuk seluruh dokumen ini: setiap rekomendasi di bawah dibingkai sebagai **"tambahkan ke yang sudah ada"**, bukan redesign. Sebagian besar Part B sudah punya fondasi UI yang bisa dipakai ulang (pola Card + filter pills + badge sudah established).

---

## Part A — Audit Metrik Platform-Level

Status: ✅ Tersedia langsung | 🔧 Perlu query/view baru (data mentah sudah ada) | 🛠️ Perlu migrasi | ❌ Data tidak ada sama sekali

| Metrik | Sumber Data | Status | Catatan |
|---|---|---|---|
| Tanggal daftar instruktur | `profiles.created_at` | ✅ | — |
| Nama bisnis, slug | `profiles.business_name`, `profiles.slug` | ✅ | — |
| Status langganan (trial/active) | `profiles.subscription_status` | ✅ | Sudah dipakai di `/admin` |
| Tanggal trial berakhir | `profiles.trial_expires_at` | ✅ | Sudah dipakai di `/admin` |
| Plan & kuota (max kelas, max broadcast/bulan) | `profiles.plan_name`, `max_active_classes`, `max_broadcast_per_month` | ✅ | Diset lewat `set-plan`, **tidak pernah dibandingkan dengan pemakaian aktual** — lihat baris kuota di bawah |
| Riwayat pembayaran langganan (ke FitFlow) | `payments` (amount, payment_date, method, duration_months) | ✅ | Ini revenue FitFlow, BUKAN revenue bisnis instruktur — lihat §B.7 untuk distingsi penting |
| Status koneksi WA bot | `profiles.bot_phone`, `bot_phone_requested`, `fonnte_token` | ✅ | Logikanya sudah ada (`botConnected = fonnte_token.length>10 && bot_phone`), tapi terduplikasi di 3 tempat (page.tsx, [profileId], AdminInstructorsList) — kandidat untuk satu helper |
| Kapan terakhir WA bot tersambung/disambung | — | ❌ | Tidak ada `connected_at`/`last_sync_at`. Hanya tahu status sekarang, bukan histori perubahan |
| Kelas aktif & terjadwal | `classes` (is_active), `sessions` (session_date) | ✅ | Sudah dipakai di `[profileId]` |
| Event mendatang | `events` (status='published', event_date >= today) | 🔧 | Data ada, belum pernah di-query di admin sama sekali |
| Member count | `members` | ✅ | Sudah dipakai di `[profileId]` |
| Community contact count, konversi ke member | `community_contacts` (converted_member_id) | 🔧 | Data ada, belum pernah ditampilkan di admin |
| Broadcast pernah dikirim, kapan terakhir | `broadcasts.sent_at`, `broadcast_recipients.status/error` | 🔧 | Data lengkap (termasuk failure log), nol visibilitas di admin saat ini |
| Pemakaian kuota bulan berjalan (X/Y kelas, X/Y broadcast) | hitung dari `classes` + `broadcasts` vs `max_active_classes`/`max_broadcast_per_month` | 🔧 | Limitnya sudah ada, pemakaiannya belum pernah dihitung di mana pun — termasuk untuk instruktur sendiri (temuan lama dari audit reporting) |
| Aktivitas terakhir instruktur (generic "last active") | tidak ada kolom tunggal | 🔧 (dengan catatan) | Harus diinferensi: `GREATEST(MAX(attendance.created_at), MAX(broadcasts.sent_at), MAX(registrations.confirmed_at), MAX(sessions terbaru))` per `user_id`. Berfungsi tapi bukan signal "login terakhir" — instruktur bisa "aktif" karena member-nya checkin, bukan karena instrukturnya buka app |
| Login terakhir (actual product usage) | — | ❌ | Supabase Auth punya `last_sign_in_at` di `auth.users` tapi belum pernah di-join ke admin manapun. Ini sinyal aktivitas paling murah & paling jujur yang belum dipakai |
| Audit log aksi admin (siapa ubah plan/trial/hapus siapa) | — | ❌ | Tidak ada tabel log sama sekali. Aman selama admin tunggal; jadi wajib begitu admin >1 orang |
| Revenue bisnis instruktur (untuk sinyal kesehatan, bukan revenue FitFlow) | `get_dashboard_summary(user_id)` RPC (sudah ada dari Laporan V2) | ✅ | RPC sudah ada dan teruji — tinggal dipanggil per-instruktur di context admin |
| Status `is_platform_admin` dipakai untuk RLS/gating | `profiles.is_platform_admin` | 🛠️ | Kolom ada, tidak dipakai. Perlu kebijakan eksplisit kapan dipakai (lihat §F Phase 2) |

**Ringkasan**: hampir semua metrik yang dibutuhkan Part B sudah **tersedia sebagai data mentah**, hanya belum di-assemble jadi view admin. Hanya dua gap data nyata: (1) tidak ada histori koneksi WA (hanya status terkini), (2) `last_sign_in_at` dari Supabase Auth belum pernah dipakai padahal gratis. Tidak ada satu pun metrik di Part A yang butuh skema baru untuk versi pertama — murni 🔧 query, bukan 🛠️ migrasi.

---

## Part B — Desain Platform Admin Dashboard

Struktur yang direkomendasikan: **bukan 7 section terpisah berat**, tapi **3 lapis kedalaman** mengikuti pola yang sudah ada di `/admin` (ringkasan → daftar tersaring → detail). Menambah section baru di lapis yang sama, bukan membangun arsitektur navigasi baru.

### Lapis 1 — `/admin` (Beranda Operator)
Tujuan: jawab "siapa yang butuh perhatian saya HARI INI" dalam &lt;10 detik. Sudah punya pola Card stat + antrian — perluas, jangan ganti.

1. **Business Overview** (perluasan dari stat cards yang sudah ada)
   - Total instruktur, Trial, Aktif, Habis (sudah ada)
   - Tambahan: instruktur baru 7 hari terakhir, growth rate sederhana (instruktur baru bulan ini vs bulan lalu)
2. **Needs Attention** (penggabungan dari 2 antrian yang sudah ada + alert baru — lihat Part E)
   - Pendaftaran menunggu konfirmasi (sudah ada)
   - Permintaan tautan bot WA (sudah ada)
   - **Baru**: trial akan habis ≤3 hari, WA terputus &gt;14 hari tanpa connect, tidak ada aktivitas &gt;14 hari
   - Ini jadi SATU inbox terurut, bukan 4 card terpisah — operator scan satu list, bukan 4 section
3. **Subscription Monitoring** (gabungan data yang sudah ada, dipisah dari Business Overview)
   - Pendapatan langganan bulan ini (sudah ada)
   - MRR (recurring, bukan one-time) — beda dari "pendapatan bulan ini" karena `payments.duration_months` bisa &gt;1, perlu dinormalisasi
   - Daftar instruktur trial expired tapi belum pernah bayar (candidate churn / belum convert)

### Lapis 2 — `/admin/instructors` (Daftar Tersaring)
Filter pills yang sudah ada (Semua/Aktif/Trial/Habis/Bot WA belum setup) sudah merupakan bentuk kasar dari **Customer Health** — perluas jadi eksplisit:

4. **Customer Health** (kolom/badge baru di list yang sudah ada, lihat Part D untuk definisi)
   - Tambahkan filter pill: "Berisiko" (at risk) dan "Tidak Aktif" (inactive) — paralel dengan pola status member (new/active/at_risk/inactive) yang sudah ada di codebase, jadi mental model-nya konsisten
5. **Product Adoption** (kolom opsional/expandable, bukan default visible — supaya list tidak terlalu padat)
   - Pernah kirim broadcast? Pernah pakai Community? Punya event published?

### Lapis 3 — `/admin/[profileId]` (Detail Instruktur)
Lihat Part C secara penuh — halaman ini sudah punya fondasi kuat, tinggal ditambah 2 section.

6. **WhatsApp Connectivity** — sudah ada di Lapis 1 (ringkasan) dan Lapis 3 (detail), tidak perlu halaman terpisah. Tambahkan riwayat (perlu 🛠️ migrasi kecil — lihat §F).
7. **Revenue Intelligence** — **sengaja dipecah jadi dua bagian yang tidak boleh tercampur**:
   - Platform revenue (FitFlow's MRR dari `payments`) → tampil di Lapis 1
   - Business revenue instruktur (dari `get_dashboard_summary`) → tampil di Lapis 3 sebagai sinyal kesehatan bisnis instruktur tersebut, BUKAN dijumlahkan sebagai "revenue platform". Mencampur keduanya akan membuat angka MRR FitFlow salah secara fundamental.

**Kenapa bukan 7 halaman terpisah**: operator tunggal (FitFlow owner) butuh kecepatan scan, bukan navigasi. Pola "stat cards di atas, inbox aksi di tengah, link ke list di bawah" yang sudah ada di `/admin` hari ini sudah benar secara UX — godaan untuk membuat 7 section sebagai 7 halaman/tab justru memecah perhatian operator. Sections di atas adalah **kategori konseptual untuk mengorganisir penambahan**, bukan 7 route baru.

---

## Part C — Customer Detail Page (`/admin/[profileId]`)

Halaman ini sudah berisi separuh dari yang dibutuhkan. Layout yang direkomendasikan (urutan = prioritas baca operator):

1. **Header** (sudah ada): nama bisnis, plan manager, trial manager, impersonate
2. **Status & Risiko** (baru, paling atas setelah header — ini yang paling sering dicari operator saat klik masuk)
   - Health badge (Healthy/At Risk/Inactive — Part D)
   - Alasan singkat kenapa badge itu muncul (mis. "Tidak ada aktivitas 18 hari, WA terputus") — jangan hanya tampilkan skor, tampilkan **kenapa**, supaya operator langsung tahu aksi apa yang dibutuhkan
3. **Info Akun** (sudah ada): email, HP, slug, status, trial, tanggal daftar
4. **Status WhatsApp Bot** (sudah ada): nomor, token, badge connected — tambahkan kapan terakhir status berubah jika migrasi §F.2 jalan
5. **Aktivitas Terbaru** (baru — timeline ringkas, bukan tabel penuh)
   - 5 event terakhir lintas tipe: sesi diajar, broadcast dikirim, registrasi event dikonfirmasi, member baru — di-merge berdasarkan timestamp, bukan per-tabel terpisah. Ini yang paling bernilai untuk operator: "apa yang sebenarnya instruktur ini lakukan minggu ini"
6. **Stat operasional** (sudah ada): kelas aktif, member, total sesi, estimasi revenue/bulan
7. **Adopsi Produk** (baru, ringkas): pernah broadcast? (ya/tidak + tanggal terakhir), pernah pakai Community? (jumlah contact), event published? (jumlah)
8. **Kelas Aktif** (sudah ada)
9. **Riwayat Pembayaran ke FitFlow** (sudah ada) — label ulang jadi eksplisit "Pembayaran Langganan" supaya tidak rancu dengan revenue bisnis instruktur
10. **Hapus Akun** (sudah ada, biarkan di paling bawah — sudah benar sebagai aksi destruktif terakhir)

Yang SENGAJA tidak direkomendasikan: tab terpisah per modul (Classes tab, Events tab, dst). Operator butuh gambaran cepat 1 instruktur, bukan menjelajah app instruktur tersebut dari sisi admin — untuk itu **Impersonate sudah ada** dan merupakan tool yang tepat. Detail page harus tetap ringkasan, bukan duplikat seluruh app instruktur.

---

## Part D — Customer Health Scoring

Prinsip: skor harus bisa dijelaskan dalam satu kalimat ke operator ("kenapa instruktur ini berisiko"), bukan angka komposit buram. Hindari vanity metrics (jumlah login, jumlah klik) — fokus ke **apakah instruktur ini menjalankan bisnisnya lewat FitFlow secara nyata**.

### Sinyal operasional (bukan vanity)

| Sinyal | Sumber | Bobot makna |
|---|---|---|
| Ada kelas aktif & terjadwal | `classes.is_active`, `sessions` masa depan | Tinggi — tanpa ini, tidak ada bisnis berjalan di app |
| Aktivitas operasional terakhir | `GREATEST(attendance, broadcasts.sent_at, registrations.confirmed_at)` | Tinggi — bukti pemakaian nyata, bukan sekadar punya akun |
| WA bot tersambung | `bot_phone` + `fonnte_token` valid | Sedang — tanpa ini broadcast & grup komunitas mati, tapi instruktur masih bisa jalan manual |
| Status langganan | `subscription_status`, `trial_expires_at` | Tinggi untuk sinyal komersial, terpisah dari sinyal pemakaian |
| Revenue bisnis instruktur bergerak (naik/turun/datar) | `get_dashboard_summary` historis | Sedang — sinyal kesehatan bisnis instruktur itu sendiri, indikasi worth retaining |

### Tier (paralel dengan pola status member yang sudah ada di codebase — `new/active/at_risk/inactive` — supaya operator pakai mental model yang sama)

- **Healthy**: ada kelas aktif DAN aktivitas operasional ≤14 hari terakhir
- **At Risk**: ada kelas aktif TAPI aktivitas operasional 15–30 hari, ATAU WA terputus &gt;14 hari padahal sebelumnya pernah tersambung
- **Inactive**: tidak ada aktivitas operasional &gt;30 hari, ATAU tidak punya kelas aktif sama sekali setelah masa onboarding (&gt;7 hari sejak daftar, nol kelas)
- **Churned**: trial habis &gt;30 hari tanpa pembayaran DAN tidak ada aktivitas — kandidat untuk follow-up komersial eksplisit, bukan auto-delete

Catatan penting: tier ini **mengukur pemakaian produk**, bukan kesehatan finansial instruktur sebagai bisnis. Instruktur bisa "Healthy" secara pemakaian tapi revenue bisnisnya turun — itu sinyal berbeda (peluang upsell/dukungan), jangan dicampur ke satu skor. Tampilkan keduanya berdampingan di detail page (§C.2 dan §C.7), bukan digabung jadi satu angka.

---

## Part E — Operational Alerts

Filosofi: alert hanya untuk hal yang **butuh aksi manusia**, bukan notifikasi informasional. Setiap alert di bawah punya "siapa yang harus saya hubungi dan kenapa" yang jelas. Semua masuk ke "Needs Attention" inbox di Lapis 1 (§B.2), bukan channel terpisah (belum ada infrastruktur push/email notifikasi platform-level — lihat §F).

| Alert | Trigger | Kenapa penting | Sudah ada datanya? |
|---|---|---|---|
| Trial akan habis | `trial_expires_at` ≤3 hari, status masih trial | Window terakhir untuk convert ke bayar | ✅ |
| Trial sudah habis, belum bayar | `trial_expires_at` &lt; now, `subscription_status` ≠ active | Akses harusnya sudah diblok backend — alert ini untuk follow-up komersial, bukan validasi teknis | ✅ |
| WA tidak pernah disambung | `bot_phone_requested` terisi &gt;3 hari, `fonnte_token` masih null | Permintaan tautan WA macet di proses operator (manual approve) — sudah ada sebagai antrian, jadikan alert dengan threshold waktu | ✅ |
| WA terputus | (butuh histori — §F.2) status berubah dari connected ke disconnected | Broadcast/grup komunitas instruktur tersebut mati tanpa instruktur sadar | 🛠️ butuh migrasi kecil |
| Tidak ada aktivitas 14 hari | sinyal §D | Instruktur kemungkinan churn diam-diam meski belum trial habis | 🔧 |
| Tidak ada kelas terjadwal | `classes` aktif = 0, atau ada kelas tapi tidak ada `sessions` masa depan | Instruktur tidak bisa generate value dari app sama sekali | 🔧 |
| Revenue bisnis turun signifikan | `get_dashboard_summary` bulan ini vs bulan lalu, drop &gt;X% | Sinyal awal sebelum churn — instruktur biasanya berhenti pakai app SETELAH bisnisnya melemah, bukan sebelum | 🔧, butuh baseline 2 bulan data jalan dulu |

**Yang sengaja TIDAK direkomendasikan sebagai alert**: jumlah login rendah, waktu sesi pendek, fitur X belum dicoba. Itu vanity/curiosity metrics yang tidak mengarah ke aksi konkret operator.

---

## Part F — Implementation Roadmap

Prinsip pengurutan: implementasi terkecil dengan nilai operasional tertinggi dulu. Karena hampir semua Part A berstatus ✅/🔧 (bukan 🛠️), **Phase 1 murni assembly UI dari data yang sudah ada** — tidak ada migrasi sama sekali.

### Phase 1 — Assembly, zero migration
1. Satu helper `getInstructorHealthSignals(profileId)` / RPC `get_admin_health_summary()` yang menghitung sinyal §D dari tabel yang sudah ada (hindari N+1 query manual yang sudah mulai terjadi di `[profileId]/page.tsx`)
2. Health badge + alasan di list (`/admin/instructors`) dan detail (`/admin/[profileId]`) — pakai helper #1
3. Gabungkan 2 antrian existing + alert baru §E (yang berstatus ✅/🔧) jadi satu "Needs Attention" inbox di `/admin`
4. Section Aktivitas Terbaru (timeline) dan Adopsi Produk di detail page — query tambahan ke `broadcasts`, `community_contacts`, `events`, tidak ada migrasi
5. Pisahkan label "Pendapatan Langganan" (FitFlow MRR) vs "Estimasi Revenue Instruktur" secara eksplisit di UI supaya tidak pernah tercampur

### Phase 2 — Kecil migrasi, masih murah
1. Join `auth.users.last_sign_in_at` ke admin — sinyal aktivitas paling murah yang belum dipakai sama sekali, bukan inferensi
2. Tabel kecil `bot_connection_events` (atau kolom `bot_connected_at`/`bot_disconnected_at` di profiles) untuk histori WA — supaya alert "WA terputus" (bukan cuma "belum pernah connect") bisa dideteksi
3. Tabel `admin_audit_log` (actor, action, target_profile_id, detail, created_at) — wajib SEBELUM `is_platform_admin` dipakai untuk admin kedua, supaya aksi (hapus akun, ubah plan, impersonate) tetap bisa ditelusuri
4. Migrasi gating dari `ADMIN_EMAIL` env var ke `is_platform_admin` flag + RLS policy — hanya genting begitu ada rencana admin &gt;1 orang; selama admin tunggal, ini bukan prioritas teknis murni keamanan-jaga-jaga

### Future (di luar scope sprint manapun sekarang)
- Notifikasi proaktif (WA/email ke FitFlow owner) untuk alert kritis, bukan hanya pasif menunggu operator buka `/admin`
- Revenue Intelligence lanjutan: MRR growth chart, cohort retention per bulan daftar
- Churn prediction lebih dari threshold sederhana (kombinasi sinyal berbobot, divalidasi dengan data churn nyata setelah cukup banyak instruktur churn untuk dipelajari polanya)
- Studio Mode / multi-instruktur — eksplisit di luar scope dokumen ini, lihat [[project_business_reporting_architecture]] untuk audit kenapa ini perubahan skema besar

---

## Ringkasan Eksekutif

- Panel admin **sudah ada dan fungsional** — fokus dokumen ini adalah evolusi terarah, bukan rebuild.
- 95% data yang dibutuhkan untuk Customer Health, Needs Attention inbox, dan Activity Timeline **sudah ada di skema**, tinggal di-assembly jadi query/RPC baru. Nol migrasi dibutuhkan untuk versi pertama yang sudah bernilai tinggi (Phase 1).
- Dua gap nyata: histori koneksi WA (hanya status terkini tersimpan) dan `last_sign_in_at` Supabase Auth yang belum pernah dipakai padahal gratis.
- Disiplin paling penting untuk dijaga ke depan: **jangan pernah mencampur revenue FitFlow (dari instruktur) dengan revenue bisnis instruktur (dari membernya)** — keduanya valid tapi menjawab pertanyaan berbeda.
- `is_platform_admin` ada di skema sejak migrasi 025 tapi tidak pernah dipakai untuk gating sungguhan — bukan bug mendesak (admin masih tunggal), tapi catatan teknis untuk saat tim FitFlow bertambah.
