# Platform Admin V1 — Final Architecture & Implementation Roadmap

**Tanggal**: 2026-06-30
**Status**: Desain final, siap jadi acuan implementasi. TIDAK ADA kode/migrasi dibuat dari dokumen ini — ini blueprint, eksekusinya terpisah.
**Sifat dokumen**: konsolidasi dari 3 dokumen sebelumnya menjadi SATU desain final yang konsisten. Tidak membuka ulang keputusan yang sudah terkunci.

### Keputusan Terkunci yang Dipakai Sebagai Fondasi (TIDAK dibahas ulang)

| Keputusan | Sumber |
|---|---|
| Aktivasi = First Attendance SAJA (bukan OR Membership Sale) | `ACTIVATION_DEFINITION_REVIEW_MEMBERSHIP_SALE.md` |
| Membership Sale = metrik Product Adoption terpisah | sama |
| "Membership Terjual, Menunggu Kehadiran Pertama" = state onboarding eksplisit | sama |
| M4.5 (Payment Confirmed) = DITOLAK, bukan milestone | `CUSTOMER_SUCCESS_FUNNEL_CRITICAL_REVIEW.md` |
| Arsitektur 3-jalur (A: Booking Publik, B: Walk-in/Manual, C: Membership) tetap valid | sama |
| Studio Mode, Multi-Instruktur, Redesign Landing Page | Deferred — di luar scope V1 |
| Panel admin dasar (`/admin`, `/admin/instructors`, `/admin/[profileId]`) sudah eksis | `PLATFORM_ADMIN_PANEL_ARCHITECTURE.md` |

---

## Part A — Audit Implementasi Saat Ini

### A.1 Halaman `/admin` yang sudah ada

| Halaman | Kondisi sekarang | Kesiapan operasional |
|---|---|---|
| `/admin` | Stat cards (total/trial/aktif/habis/revenue), antrian pendaftaran, antrian link WA, status device fallback | Fondasi baik — butuh tambahan Activation/Health (Part B) |
| `/admin/instructors` | Search, filter pills (Aktif/Trial/Habis/Bot WA belum setup), badge trial countdown | Fondasi baik — butuh kolom Stage/Health (Part C). **Catatan skala**: load SEMUA profil sekaligus ke client (`useMemo` filter), tidak ada pagination — masalah nyata begitu lewat ~100 baris (lihat Part H) |
| `/admin/[profileId]` | Info akun, status WA, stat (kelas/member/sesi/revenue), kelas aktif, sesi terbaru, riwayat pembayaran, trial/plan manager, impersonate, hapus | Fondasi baik — butuh checklist Aktivasi + timeline (Part D) |
| `/admin/classes`, `/admin/events`, `/admin/members`, `/admin/broadcasts`, `/admin/community` | **Temuan baru**: kelima halaman ini adalah **browser data mentah lintas-tenant** — list flat semua baris (dibatasi 200), filter dropdown per instruktur, **nol agregasi, nol framing operasional**. Lebih mirip alat debug internal daripada alat monitoring SaaS | **Rendah** untuk tujuan "SaaS operations" — tidak salah, tapi tidak menjawab "siapa butuh perhatian saya" sama sekali. Direkomendasikan direframe, bukan diperluas begitu saja (lihat Part H) |
| `/admin/config` | Editor `system_config` | Cukup, di luar scope dokumen ini |

### A.2 API admin yang sudah ada
`record-payment`, `set-plan`, `extend-trial`, `impersonate`, `confirm-request`, `reject-request`, `delete-instructor`, `config`. Tidak ada API baru yang wajib dibuat untuk V1 — semua kebutuhan baru di dokumen ini adalah QUERY/RPC baca, bukan mutasi baru.

### A.3 Klasifikasi Data untuk Setiap Kebutuhan V1

| Kebutuhan | Sumber | Status |
|---|---|---|
| Status langganan, trial, plan, kuota | `profiles` | ✅ Tersedia |
| Riwayat pembayaran ke FitFlow | `payments` | ✅ Tersedia |
| Status koneksi WA (snapshot) | `profiles.bot_phone/fonnte_token/bot_phone_requested` | ✅ Tersedia |
| Histori perubahan koneksi WA | — | ❌ Tidak ada (hanya snapshot, lihat audit sebelumnya) |
| Login terakhir instruktur | `auth.users.last_sign_in_at` | ✅ Tersedia, **belum pernah dipakai di mana pun** |
| M0-M2 (akun, slug, kelas/event pertama) | `instructor_requests`, `profiles.slug`, `classes`, `events` | ✅ Tersedia |
| M3-M4 (publish, registrasi) — Jalur A | `classes.show_registrations`, `events.status`, `registrations` | ✅ Tersedia |
| M5 Aktivasi (Attendance, jalur mana pun) | `attendance`, `registrations.attended` | ✅ Tersedia |
| "Membership Terjual, Menunggu Kehadiran" | `member_memberships` dibandingkan dengan `attendance` per `member_id` | 🔧 Perlu query gabungan, data mentah sudah ada |
| M6/M7 (Community, Broadcast) | `community_contacts`, `broadcasts.sent_at` | ✅ Tersedia |
| Health tier (lihat Part E) | gabungan `attendance`, `registrations`, `broadcasts`, `classes.is_active` | 🔧 Perlu RPC agregasi, semua data mentah sudah ada |
| Revenue bisnis instruktur (sinyal kesehatan, BUKAN MRR FitFlow) | `get_dashboard_summary()` RPC, sudah ada dari Laporan V2 | ✅ Tersedia, tinggal dipanggil di context admin |
| Audit log aksi admin | — | ❌ Tidak ada, belum genting (admin tunggal) |
| `is_platform_admin` dipakai untuk gating | `profiles.is_platform_admin` | 🛠️ Kolom ada, tidak dipakai — belum genting di V1 |

**Kesimpulan Part A**: tidak ada satu pun kebutuhan V1 yang butuh migrasi skema. Semuanya 🔧 (query/RPC baru) di atas data yang sudah ✅ tersedia. Satu-satunya 🛠️ asli (histori koneksi WA) ditunda ke Phase 2 (Part H) karena dampaknya kecil untuk V1 (status snapshot saat ini sudah cukup untuk sebagian besar use-case alert).

---

## Part B — Platform Dashboard V1: Section Final

Struktur final, dengan alasan eksplisit kenapa SETIAP section ada (atau sengaja tidak ada):

1. **Business Overview** — stat cards yang sudah ada, diperluas dengan instruktur baru 7 hari terakhir dan growth rate sederhana.
2. **Needs Attention** (inbox tunggal, BUKAN per-jenis-alert terpisah) — gabungan antrian yang sudah ada (pendaftaran, link WA) + alert baru terkunci dari Part F. Satu list terurut prioritas, bukan banyak card.
3. **Onboarding & Activation Funnel** (BARU) — distribusi instruktur per stage (Part G), Activation Rate cohort bulan ini vs bulan lalu. Satu angka utama (Activation Rate), bukan dashboard BI penuh grafik.
4. **Customer Health** (BARU) — distribusi 4 tier (Part E), HANYA untuk instruktur yang sudah Activated (lihat aturan serah-terima di Part E).
5. **Subscription Monitoring** — pendapatan langganan FitFlow bulan ini (sudah ada) + daftar trial mendekati habis. MRR dihitung benar dari `payments.duration_months` (dinormalisasi), bukan sekadar jumlah transaksi bulan berjalan.
6. **WhatsApp Connectivity** — breakdown status (connected/pending/disconnected) lintas semua instruktur, plus antrian link yang sudah ada.
7. **Product Adoption** — breadth kepakaian: % instruktur Activated yang pernah pakai Community, Broadcast, Membership. Sinyal upsell/edukasi, eksplisit dipisah dari Activation supaya tidak ikut menggelembungkan metrik utama (sesuai keputusan terkunci).

**Yang SENGAJA tidak dibuat sebagai section terpisah**: "Revenue Intelligence" sebagai section ketujuh model lama. Dengan <100 customer dan belum ada baseline historis, grafik trend MRR/growth akan lebih sering jadi noise daripada sinyal. Revenue FitFlow cukup sebagai satu angka di Subscription Monitoring (#5) untuk V1; analitik tren MRR masuk Future (Part H), bukan V1.

---

## Part C — Customer List View

Kolom final untuk tabel utama (urutan = prioritas baca operator saat scan 100 baris):

| Kolom | Isi | Kenapa |
|---|---|---|
| **Nama Bisnis** | `business_name` + slug | Identitas |
| **Status** (badge gabungan) | Stage funnel (kalau belum Activated) ATAU Health tier (kalau sudah) — **satu badge, bukan dua**, sesuai aturan serah-terima Part E | Operator butuh SATU sinyal "kondisi" per baris, bukan dua sistem skor berdampingan yang membingungkan |
| **Langganan** | Trial/Aktif/Habis + sisa hari trial | Sudah ada, dipertahankan |
| **Member** | Jumlah member | Ukuran bisnis kasar |
| **WA** | Badge connected/pending/belum | Sudah ada, dipertahankan |
| **Aktivitas Terakhir** | Tanggal, relatif ("3 hari lalu") — `GREATEST` lintas attendance/broadcast/registrasi | Sinyal kesehatan paling cepat dibaca |
| **Daftar** | Tanggal `created_at` | Konteks cohort |

**Sengaja TIDAK dijadikan kolom default**: Revenue bisnis instruktur (relevan di detail page, bukan untuk scan cepat 100 baris — angka tanpa konteks rentan disalahartikan sebagai MRR FitFlow, risiko pencampuran yang sudah diperingatkan di audit sebelumnya).

**Filter**: pills yang sudah ada (Semua/Aktif/Trial/Habis/Bot WA belum setup) + tambahan: per Stage (Setup/Go-Live/First Traction) dan per Health tier (Healthy/Needs Attention/At Risk/Inactive) — dua grup filter terpisah karena Stage dan Health adalah dua sistem yang melayani populasi berbeda (pra- vs pasca-Aktivasi), tidak bisa digabung jadi satu dropdown tanpa membingungkan.

**Sorting**: default = Aktivitas Terakhir (paling stale dulu, supaya yang paling butuh perhatian muncul di atas) — bukan default alfabetis atau tanggal daftar. Tambahan: urut berdasarkan sisa hari trial (untuk fokus konversi).

**Skala**: di atas ~100 baris, list client-side filter (pola `AdminInstructorsList` sekarang) mulai berat — Part H menandai ini sebagai item Phase 1/2, bukan murni kosmetik.

---

## Part D — Customer Detail View

Catatan penamaan: task menyebut `/admin/customer/[id]`, sedangkan rute yang sudah eksis adalah `/admin/[profileId]`. **Rekomendasi: pertahankan rute yang sudah ada** — rename murni kosmetik, tidak menambah nilai, hanya menambah churn. Dokumen ini memakai istilah "Customer Detail Page" secara generik.

Layout final (urutan = prioritas baca operator begitu klik masuk):

1. **Header** (sudah ada): nama bisnis, plan manager, trial manager, impersonate
2. **Status Summary** (BARU, paling atas setelah header): badge Stage ATAU Health (sesuai posisi instruktur ini), plus SATU baris alasan ("Tidak ada aktivitas 18 hari, WA terputus" / "Stage: First Traction, menunggu registrasi pertama")
3. **Onboarding & Activation Checklist** (BARU) — M0-M7 dengan kesadaran jalur (Part G): kalau instruktur ini Jalur B/C, jangan tampilkan M3/M4 sebagai "belum selesai" (akan selalu kosong secara struktural, bukan kegagalan). Termasuk badge eksplisit "Membership Terjual, Menunggu Kehadiran Pertama" kalau berlaku.
4. **Info Akun** (sudah ada)
5. **Status WhatsApp Bot** (sudah ada)
6. **Aktivitas Terbaru** (BARU) — timeline ringkas 5 event terakhir lintas tipe (sesi diajar, broadcast dikirim, registrasi dikonfirmasi, member baru, membership terjual), digabung berdasarkan timestamp
7. **Stat Operasional** (sudah ada): kelas aktif, member, total sesi, estimasi revenue bisnis instruktur
8. **Product Adoption** (BARU, ringkas): pernah broadcast (ya/tidak + tanggal terakhir), pernah pakai Community (jumlah contact), pernah jual membership (jumlah paket)
9. **Kelas Aktif** (sudah ada)
10. **Riwayat Pembayaran ke FitFlow** (sudah ada, label diperjelas jadi "Pembayaran Langganan" — supaya tidak rancu dengan revenue bisnis instruktur di #7)
11. **Hapus Akun** (sudah ada, tetap paling bawah)

**Sengaja tidak dibuat**: tab per modul (Classes tab, Events tab, dst). Impersonate sudah ada sebagai tool yang tepat untuk operator yang butuh masuk lebih dalam — detail page tetap ringkasan, bukan duplikat seluruh app instruktur.

---

## Part E — Customer Health Model (4 Tier)

**Aturan serah-terima yang mengikat seluruh model ini**: tier ini HANYA berlaku untuk instruktur yang SUDAH mencapai M5 (Activation = first Attendance, sesuai keputusan terkunci). Instruktur yang belum Activated dinilai lewat Stage funnel (Part G), bukan tier ini — dua sistem tidak pernah tampil bersamaan untuk instruktur yang sama.

Prinsip: tiap tier harus bisa dijelaskan dalam satu kalimat sebab-akibat, bukan skor komposit 0-100. Tidak ada bobot tersembunyi, tidak ada persentase arbitrer — setiap threshold below dipilih supaya konsisten dengan pola yang SUDAH ada di codebase (threshold 14/30 hari yang dipakai `compute_business_activity_status` untuk member), bukan angka baru yang ditebak.

| Tier | Definisi | Kenapa threshold ini |
|---|---|---|
| **Healthy** | Aktivitas operasional (attendance/registrasi terkonfirmasi/broadcast terkirim, mana pun lebih baru) ≤14 hari | Sama dengan threshold "active" member yang sudah established di codebase — instruktur yang menjalankan kelas mingguan akan selalu masuk kategori ini selama rutin |
| **Needs Attention** | Aktivitas 15-30 hari, ATAU WA yang tadinya tersambung sekarang terputus | Band peringatan dini — belum krisis, tapi pola mulai melambat dari ritme mingguan normal. Sama dengan band "at_risk" member, tapi diberi nama lebih lunak karena ini level instruktur (skala dampak lebih besar — satu instruktur diam = seluruh roster kelasnya ikut diam) |
| **At Risk** | Aktivitas 31-60 hari, ATAU langganan aktif/trial TAPI nol kelas aktif sekarang | Dua kondisi berbeda sengaja digabung satu tier: keduanya sama-sama berarti "kemungkinan besar tidak lagi pakai FitFlow untuk operasional inti", baik karena sudah lama tidak ada aktivitas ATAU karena secara struktural tidak mungkin ada aktivitas (tidak ada kelas berjalan) |
| **Inactive** | Aktivitas &gt;60 hari, ATAU trial sudah habis &gt;30 hari tanpa pernah mencapai Aktivasi sama sekali | Band terakhir sebelum dianggap churn penuh — ambang lebih panjang dari member (60 vs 30 hari) karena instruktur yang nonaktif &gt;30 hari masih punya kemungkinan wajar untuk kembali (libur, cuti), beda dengan member individual |

**Yang sengaja TIDAK dijadikan skor**: tidak ada angka komposit weighted (mis. "72/100 Health Score"). Setiap tier adalah hasil dari aturan eksplisit yang bisa ditelusuri sebabnya satu per satu — konsisten dengan prinsip "hindari vanity scoring" yang diminta di task ini dan sudah jadi prinsip kerja proyek ini sejak audit Platform Admin pertama.

---

## Part F — Operational Alerts (Daftar Final)

Diurutkan dari prioritas tertinggi, dengan keputusan eksplisit terima/tolak untuk tiap kandidat dari task:

| Alert | Keputusan | Alasan |
|---|---|---|
| Trial akan habis ≤3 hari, BELUM Activated | **Terima, prioritas tertinggi** | Implikasinya beda total dari trial habis yang sudah Activated — ini kandidat churn-tanpa-pernah-merasakan-nilai, paling mendesak |
| Trial akan habis ≤3 hari, SUDAH Activated | **Terima, prioritas lebih rendah** | Kemungkinan besar akan bayar — pesan/follow-up beda dari di atas |
| Membership terjual, belum ada kehadiran &gt;14 hari | **Terima** | Eksekusi langsung dari keputusan terkunci "Membership Terjual, Menunggu Kehadiran Pertama" |
| Macet di Go-Live &gt;14 hari | **Terima, DENGAN syarat wajib**: hanya untuk instruktur yang sudah mulai Jalur A (punya kelas/event yang diusahakan publish) | Tanpa syarat ini, alert akan salah tembak ke seluruh populasi Jalur B/C murni — risiko alert fatigue yang sudah diidentifikasi di review sebelumnya |
| Registrasi lewat tanggal sesi, presensi masih kosong | **Terima** | Gap workflow nyata (instruktur lupa catat presensi), bukan ambigu |
| WA terputus (status sekarang) | **Terima dengan keterbatasan dicatat**: tanpa histori koneksi (🛠️ Phase 2), hanya bisa deteksi "sedang terputus", bukan "baru saja terputus" — V1 pakai status snapshot apa adanya | Lebih baik alert kasar yang ada daripada menunggu migrasi |
| Tidak ada aktivitas 14 hari (sebagai ALERT terpisah) | **Tolak sebagai alert duplikat** | Ini sudah TEPAT SAMA dengan kriteria masuk tier "Needs Attention" (Part E) — jadi alert terpisah hanya akan menduplikasi sinyal yang sudah terlihat lewat filter Health tier di Customer List. Operator scan lewat filter tier, bukan lewat notifikasi berulang |
| Lonjakan pertumbuhan registrasi | **Tolak untuk V1** | Butuh baseline historis untuk tahu apa itu "lonjakan" — dengan volume customer saat ini, sinyal ini lebih banyak noise daripada informasi. Masuk Future (Part H) setelah cukup data historis terkumpul |
| Penurunan revenue | **Tolak untuk V1**, alasan sama dengan di atas | Revenue bisnis instruktur sudah bisa dilihat di detail page (Part D #7) sebagai angka titik-waktu — trend/drop-detection butuh baseline yang belum ada |

---

## Part G — Customer Success View (Pemantauan Funnel M0-M7)

### Stage final (sadar-jalur, sesuai arsitektur 3-jalur terkunci)

| Stage | Kriteria | Berlaku untuk |
|---|---|---|
| **Signup** | M0 selesai, slug belum diisi | Semua |
| **Setup** | Slug terisi, belum ada kelas/event | Semua |
| **Go-Live** (kondisional) | Ada kelas/event, belum dipublish, DAN sedang aktif mengusahakannya (masih rutin update) | Hanya ditampilkan untuk instruktur yang terdeteksi mengarah ke Jalur A |
| **First Traction** | Sudah punya kelas/event (dipublish ATAU tidak — tergantung jalur), menunggu Aktivasi | Semua, jalur apa pun |
| **Activated** | M5 tercapai (Attendance pertama, jalur mana pun) | Lulus dari funnel, masuk Health Tier (Part E) |

### "Stuck" detection — jawaban langsung atas pertanyaan inti Part G

Operator tahu instruktur tersangkut di mana lewat aturan eksplisit berikut, bukan tebakan:

| Sinyal stuck | Kondisi | Makna |
|---|---|---|
| Tidak pernah mulai | M0 selesai &gt;3 hari, slug masih kosong | Kemungkinan belum login sama sekali sejak dapat kredensial |
| Macet di Setup | Slug terisi &gt;7 hari, nol kelas/event | Friksi di form pembuatan kelas/event pertama |
| Macet di Go-Live (Jalur A saja) | Punya kelas/event &gt;14 hari, belum publish, MASIH rutin update | Kemungkinan tidak tahu toggle publish ada — **bukan** ditembak ke instruktur yang sudah lama tidak sentuh kelasnya sama sekali (itu sinyal beda: ditinggalkan, bukan macet aktif) |
| **Belum pernah jalan sesi pertama (Jalur B/C)** — kasus BARU yang tidak tertangkap model lama | Punya kelas aktif &gt;14 hari sejak dibuat, NOL attendance pernah tercatat, BUKAN karena belum publish (karena Jalur B/C tidak butuh publish) | Kasus murni baru dari arsitektur 3-jalur: instruktur sudah setup kelas tapi entah kenapa tidak pernah mulai operasional nyata. Sebelumnya tidak terdeteksi sama sekali kalau funnel masih versi lama yang cuma mengenal Jalur A |
| Membership terjual, menunggu kehadiran &gt;14 hari | Sesuai Part F | Kemungkinan member belum datang ke sesi pertamanya, atau dijual untuk member yang sebenarnya tidak akan lanjut |

Baris "Belum pernah jalan sesi pertama (Jalur B/C)" adalah temuan yang baru bisa muncul SETELAH arsitektur 3-jalur dikunci — funnel versi awal (single-path) tidak akan pernah mendeteksi kasus ini sama sekali, karena dulu hanya M3/M4 yang dipantau.

---

## Part H — Implementation Roadmap

### Phase 1 — Assembly, nol migrasi

1. RPC `get_instructor_funnel_status(profile_id)` — menghitung Stage (Part G) dan kesadaran-jalur, dari data yang sudah ada
2. RPC `get_instructor_health_tier(profile_id)` — 4 tier (Part E), hanya jalan untuk instruktur yang sudah Activated
3. Kolom Status gabungan (Stage/Health) + filter ganda di `/admin/instructors`, pakai dua RPC di atas
4. Inbox "Needs Attention" final — gabung antrian existing + alert dari Part F yang sudah ✅/🔧 (semua kecuali WA-disconnect-history dan trend-based alerts)
5. Customer Detail: tambah Status Summary, Onboarding Checklist (sadar-jalur), Activity Timeline, Product Adoption — semua query tambahan, nol migrasi
6. **Reframe 5 halaman browser data mentah** (classes/events/members/broadcasts/community di admin): minimal, link-kan secara kontekstual DARI halaman detail customer (bukan sebagai halaman jelajah global terpisah) — browsing 200 baris lintas-tenant tanpa konteks bukan pola operasional yang scale lewat ~20 customer

### Phase 2 — Migrasi kecil

1. Join `auth.users.last_sign_in_at` — sinyal aktivitas termurah yang belum pernah dipakai
2. Histori koneksi WA (`bot_connected_at`/`bot_disconnected_at`) — supaya alert WA-disconnect jadi event-driven, bukan cuma snapshot
3. `admin_audit_log` — wajib SEBELUM `is_platform_admin` dipakai untuk admin kedua
4. Pagination/virtualization di `/admin/instructors` — bukan sekadar nice-to-have, jadi kebutuhan nyata begitu lewat ~100 baris (lihat Part A.1, Part C)
5. Gating `is_platform_admin` + RLS — hanya genting kalau tim admin FitFlow bertambah

### Future

1. Alert berbasis tren (lonjakan registrasi, penurunan revenue) — setelah cukup data historis untuk baseline yang valid
2. Notifikasi proaktif (WA/email) untuk alert kritis, bukan hanya pasif di dashboard
3. Funnel chart per-jalur terpisah (3 mini-funnel) — setelah volume instruktur cukup besar untuk itu bernilai dibanding satu funnel sadar-jalur yang sudah ada di V1
4. Studio Mode / Multi-Instruktur — eksplisit deferred, bukan scope dokumen mana pun di rangkaian ini

---

## Ringkasan Eksekutif

- V1 ini murni **assembly di atas fondasi yang sudah ada** — panel admin dasar sudah eksis, hampir semua data yang dibutuhkan sudah ✅ tersedia. Nol migrasi untuk Phase 1.
- Satu temuan baru di audit ini: 5 halaman admin existing (classes/events/members/broadcasts/community) adalah browser data mentah, bukan alat operasional — direkomendasikan direframe (link kontekstual dari detail customer), bukan dijadikan basis perluasan.
- Health Tier (4 tingkat: Healthy/Needs Attention/At Risk/Inactive) HANYA berlaku pasca-Aktivasi; Stage funnel mengisi sebelum itu — dua sistem yang tidak pernah tumpang tindih, sesuai aturan serah-terima yang sudah dikunci.
- Stuck-detection di Part G punya satu kasus BARU yang baru bisa ada setelah arsitektur 3-jalur dikunci: instruktur Jalur B/C yang setup kelas tapi tidak pernah menjalankan sesi pertama — kasus ini tidak terdeteksi sama sekali oleh model funnel versi awal (single-path).
- Dua alert dari contoh task (lonjakan registrasi, penurunan revenue) DITOLAK untuk V1 secara eksplisit — butuh baseline historis yang belum ada, akan jadi noise bukan sinyal di volume customer saat ini.
- Item operasional paling kritis untuk diperhatikan ke depan, di luar fitur: **pagination/virtualization customer list** begitu lewat ~100 baris — ini infrastruktur, bukan fitur, dan kalau diabaikan akan jadi bottleneck nyata persis di titik 100 customer yang ditanyakan task ini.
