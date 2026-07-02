# Platform Admin V1 — Implementation Plan

**Tanggal**: 2026-06-30
**Status**: Rencana implementasi. Fase desain SUDAH DITUTUP — dokumen ini tidak membuka ulang keputusan apa pun dari `PLATFORM_ADMIN_V1_FINAL_DESIGN.md` dan `PLATFORM_ADMIN_V1_PRE_IMPLEMENTATION_REVIEW.md`. Semua keputusan terkunci (funnel M0-M7, Aktivasi = Attendance saja, Membership Sale = Product Adoption, broadcast dihapus dari Health Tier, alert Pending Registration disetujui, alert WA Disconnected ditunda) dipakai sebagai INPUT TETAP, bukan dibahas ulang. TIDAK ADA kode/migrasi dibuat dari dokumen ini.

---

## Part A — Implementation Readiness Audit

| Dashboard Section | Current Source | Gap | Kompleksitas |
|---|---|---|---|
| Business Overview (trim) | `profiles`, sudah dipakai di `/admin` | Hapus angka status-langganan yang terduplikasi (pindah ke Subscription Monitoring) | **Rendah** |
| Customer Health (4 tier) | `attendance`, `registrations.confirmed_at`, `classes.is_active`, status WA | Butuh view/RPC agregasi baru (broadcast TIDAK diikutkan, sesuai review) | **Sedang** |
| Customer Funnel (Stage) | `instructor_requests`, `profiles.slug`, `classes`, `events`, `attendance`, `member_memberships` | Butuh RPC baru sadar-jalur (3-path) | **Sedang** |
| Subscription Monitoring | `profiles`, `payments` | Normalisasi MRR dari `duration_months`, gabung counts dari Business Overview | **Rendah** |
| WhatsApp Connectivity | `profiles.bot_phone/fonnte_token/bot_phone_requested` | Breakdown agregat lintas instruktur, query baru di atas data yang sudah ada | **Rendah** |
| Product Adoption | `community_contacts`, `broadcasts`, `member_memberships` | Query breadth (% instruktur Activated yang pernah pakai tiap modul) | **Rendah-Sedang** |
| Operational Alerts (Needs Attention) | Gabungan semua di atas + `registrations` | Logika rollup-per-instruktur baru untuk 2 alert, dedup/snooze untuk 1 alert | **Sedang** |
| Customer List columns/filters | `profiles` + hasil RPC Health/Funnel | Kolom Pending Items baru, reorder kolom, sort default baru | **Rendah-Sedang** |
| Customer Detail additions | Hasil RPC Health/Funnel + `community_contacts`/`broadcasts`/`member_memberships` | Status Summary, Checklist, Timeline, Product Adoption section | **Sedang** |

**Tidak ada satu section pun yang masuk kategori "Missing source data entirely"** — semua data mentah sudah ada (dikonfirmasi di 3 audit sebelumnya). Kompleksitas tertinggi yang ada cuma "Sedang", bukan "Tinggi" — karena semuanya query/RPC baru di atas data existing, bukan fitur baru.

---

## Part B — Inventaris Aset yang Sudah Ada

| Aset | Reusable As-Is | Reusable dengan Ekstensi Minor | Harus Dibangun Baru |
|---|---|---|---|
| `/admin`, `/admin/instructors`, `/admin/[profileId]` (halaman + layout) | ✅ — fondasi struktur dipakai langsung | | |
| `AdminInstructorsList.tsx` (search, filter pills, badge pattern) | | ✅ — pola pill/badge yang sudah ada diperluas, bukan diganti | |
| API admin (`record-payment`, `set-plan`, `extend-trial`, `impersonate`, dst) | ✅ — tidak ada API baru yang wajib | | |
| `get_dashboard_summary()` RPC (revenue bisnis instruktur) | ✅ — tinggal dipanggil di context admin untuk Customer Detail | | |
| `get_broadcast_stats()` RPC | ✅ — bisa dipakai untuk Product Adoption breadth | | |
| `member_summary` view + `compute_business_activity_status()` (migrasi 068-071) | | ✅ — **pola arsitekturnya** (status dihitung murni saat baca, bukan disimpan+cron) adalah PRESEDEN LANGSUNG untuk Health Tier instruktur — replikasi pola, bukan reuse kode literal | |
| `recompute_member_last_attended()` primitive (migrasi 069, GREATEST lintas sumber aktivitas) | | ✅ — pola yang sama persis dipakai untuk hitung "aktivitas terakhir instruktur" (GREATEST attendance + registrasi terkonfirmasi) | |
| `instructor_requests` table + `confirm-request` API | ✅ — sumber M0 funnel, tidak berubah | | |
| `profiles.slug`, `.bot_phone`, `.fonnte_token`, dst | ✅ — sumber M1 funnel + WA status, tidak berubah | | |
| 5 halaman browser data mentah (`/admin/classes` dst) | ✅ — tetap ada apa adanya, di-link kontekstual dari Customer Detail (bukan dirombak) | | |
| RPC Health Tier (4 tier, broadcast dikecualikan) | | | ✅ **Baru** |
| RPC Funnel Stage (sadar-jalur) | | | ✅ **Baru** |
| Logika rollup-per-instruktur untuk alert | | | ✅ **Baru** |
| Kolom Pending Items di Customer List | | | ✅ **Baru** |

**Kesimpulan Part B**: dua RPC baru (Health Tier, Funnel Stage) adalah satu-satunya pekerjaan backend yang benar-benar baru secara konsep — semuanya lain adalah ekstensi UI di atas pola yang sudah established di codebase ini.

---

## Part C — Implementasi Platform Dashboard per Section

| Section | Data Source | Strategi Query | Komponen UI | Dependency |
|---|---|---|---|---|
| **Business Overview** | `profiles` | Query langsung (count + filter tanggal), TIDAK pakai RPC baru | Stat cards (pola existing) | Tidak ada |
| **Customer Health** | RPC Health Tier (baru) | Satu query agregat (`GROUP BY tier`) atas hasil RPC/view, BUKAN N+1 per instruktur | Distribution chart (4 bar/segment) + link ke Customer List terfilter | RPC Health Tier harus ada dulu |
| **Customer Funnel** | RPC Funnel Stage (baru) | Sama — satu query agregat `GROUP BY stage`, bukan loop per baris | Horizontal funnel chart + Activation Rate cohort (bulan ini vs lalu) | RPC Funnel Stage harus ada dulu |
| **Subscription Monitoring** | `profiles`, `payments` | Query langsung: count by `subscription_status`, SUM `payments.amount` dinormalisasi `/duration_months` untuk MRR, list trial mendekati habis | Stat cards + list kecil (trial countdown) | Tidak ada |
| **Product Adoption** | `community_contacts`, `broadcasts`, `member_memberships` | 3 query `COUNT(DISTINCT user_id)` terhadap populasi instruktur Activated, dibagi total Activated → persentase | 3 progress-bar/persentase sederhana | RPC Funnel Stage (untuk tahu siapa "Activated" sebagai pembagi) |
| **Operational Alerts** | Gabungan semua di atas | Satu query per jenis alert, di-UNION jadi satu list, diurutkan prioritas manual (bukan kronologis murni) | List/inbox dengan badge prioritas | RPC Health+Funnel untuk sebagian alert (mis. Stuck Go-Live butuh tahu stage) |

**Catatan implementasi kritis** (bukan desain ulang, murni teknis): Customer Health dan Customer Funnel HARUS dihitung sebagai satu query/view agregat untuk seluruh populasi instruktur sekaligus, bukan dipanggil per-baris saat render list. Ini sudah ditandai sebagai risiko di review sebelumnya (N+1) — di sini ditegaskan jadi syarat implementasi, bukan saran opsional.

---

## Part D — Implementasi Customer List

| Item | Status | Catatan |
|---|---|---|
| Kolom Business Name | **Existing** | Tidak berubah |
| Kolom Status (gabungan Stage/Health) | **New** | Wajib pakai hasil RPC Part C, satu badge per baris (tidak pernah dua sistem sekaligus, sesuai aturan serah-terima funnel↔health) |
| Kolom Last Activity | **New** (bagian dari logika Health) | Ditaruh bersebelahan dengan kolom Status (sesuai rekomendasi review) |
| Kolom Pending Items (badge) | **New** | Gabungan count Pending Registration + Membership Awaiting — dua alert ini WAJIB sudah jalan dulu sebelum kolom ini bisa diisi (dependency ke Part F) |
| Kolom Subscription | **Existing** | Tidak berubah |
| Kolom WA Status | **Existing** | Tidak berubah |
| Kolom Member Count | **Extend** | Diturunkan ukuran/posisi (rekomendasi review), bukan dihapus |
| Kolom Created Date | **Extend** | Dipindah dari kolom default ke opsi sort saja |
| Filter pills existing (Aktif/Trial/Habis/Bot WA) | **Existing** | Tidak berubah |
| Filter Stage (baru) | **New** | Butuh RPC Funnel Stage |
| Filter Health tier (baru) | **New** | Butuh RPC Health Tier |
| Sort default = Last Activity (paling stale dulu) | **New** | Ganti default lama (kemungkinan alfabetis/tanggal daftar) |

**Jalur tercepat ke nilai operasional**: bangun kolom Status + Last Activity DULU (hanya butuh dua RPC inti), baru susul kolom Pending Items (butuh alert logic Part F selesai) dan filter granular. Operator sudah dapat nilai besar (tahu siapa stuck/sehat) sebelum semua badge detail lengkap.

---

## Part E — Implementasi Customer Detail Page

| Fase | Section yang ditambah | Sumber data |
|---|---|---|
| **Phase 1** | Status Summary (badge + 1 baris alasan) | RPC Health/Funnel — alasan diturunkan langsung dari kondisi yang memicu tier/stage, bukan teks baru yang harus ditulis manual |
| **Phase 1** | Onboarding & Activation Checklist (M0-M7, sadar-jalur) | RPC Funnel Stage — checklist HANYA menampilkan milestone yang relevan untuk jalur instruktur tsb |
| **Phase 1** | Aktivitas Terbaru (timeline 5 event) — **klasifikasi 2-tier terkunci (2026-06-30, final, tidak dibuka ulang)**: **Tier 1 (Business Activity)** = Attendance, Event Attended, Registration Confirmed, Membership Sold — sumber `attendance`, `registrations.confirmed_at`/`.attended`, `member_memberships.created_at`. **Tier 2 (Product Usage)** = Broadcast, Community, Landing Page Update — sumber `broadcasts.sent_at`, `community_contacts.created_at`, `classes.show_registrations`/`events.status` toggles. Timeline boleh menampilkan keduanya, TAPI urutan tampil TIDAK BOLEH murni berdasar timestamp mentah — item Tier 2 yang lebih baru tidak boleh terlihat "lebih penting" daripada item Tier 1 yang lebih lama (mis. "Broadcast kemarin" tidak boleh mengalahkan urutan visual "Attendance 3 hari lalu"). Implementasi: render Tier 1 sebagai entri utama (bobot visual lebih besar/warna beda), Tier 2 sebagai entri sekunder (lebih kecil/muted) — bukan satu list rata tersortir murni by timestamp. Ini penegasan eksplisit dari prinsip yang sama yang sudah dipakai untuk exclude broadcast dari Health Tier — jangan sampai timeline diam-diam membatalkan pemisahan itu secara visual |
| **Phase 1** | Product Adoption summary (per-instruktur) | `community_contacts` count, `broadcasts` count+tanggal terakhir, `member_memberships` count |
| **Phase 2** | — | (tidak ada item Phase 2 baru untuk Customer Detail — semua kebutuhan V1 sudah terjawab data existing) |
| **Future** | Drill-down detail per milestone (mis. klik M4 → lihat daftar registrasi) | Butuh UI lebih dalam, bukan prioritas V1 |

**Prinsip dipegang ketat**: tidak ada metrik baru yang "diciptakan" di sini — semua section di atas adalah pembacaan ulang data yang sudah dikonfirmasi ✅ tersedia di tiga audit sebelumnya. Tidak ada estimasi/asumsi data yang belum terbukti.

---

## Part F — Implementasi Operational Alerts

| Alert | Source | Trigger | Pendekatan Implementasi | Risiko False-Positive |
|---|---|---|---|---|
| Trial habis ≤3 hari, belum Activated | `profiles.trial_expires_at`, RPC Funnel Stage | `trial_expires_at` BETWEEN now AND now+3d AND stage≠Activated | Query langsung, **siap kirim segera** | Rendah |
| Trial habis ≤3 hari, sudah Activated | sama, prioritas visual lebih rendah | sama, stage=Activated | Query langsung, **siap kirim segera** | Rendah |
| **Pending Registration &gt; 24 jam** | `registrations.payment_status='pending'`, `registered_at` | `registered_at` &lt; now-24h AND `payment_status='pending'` | Query langsung per registrasi, **WAJIB di-rollup**: `GROUP BY user_id, COUNT(*)` sebelum ditampilkan — **siap kirim segera setelah rollup dibuat** (bukan dasar teknis yang rumit) | **Sedang** — payment tunai/OTS yang auto-confirm instan TIDAK akan pernah masuk sini (bagus, menyaring otomatis ke kasus transfer-menunggu-verifikasi); risiko false-positive utama: instruktur yang sengaja menunda konfirmasi karena alasan bisnisnya sendiri (mis. menunggu bukti tambahan) — bukan kegagalan, tapi akan tetap muncul di alert. Diterima sebagai trade-off (lebih baik over-alert ringan daripada mengulang insiden UAT-001) |
| **Membership Sold, Awaiting First Attendance** | `member_memberships.created_at`, `attendance` per `member_id` | Member punya `member_memberships` aktif, NOL `attendance` untuk member itu, &gt;14 hari sejak `created_at` | Query `LEFT JOIN attendance`, filter `attendance.id IS NULL`, **WAJIB di-rollup** per instruktur sama seperti di atas — **siap kirim segera setelah rollup dibuat** | Rendah — logikanya bersih, tidak ada ambiguitas data |
| **Stuck di Go-Live** (Jalur A saja) | `classes`/`events`, `show_registrations`/`status`, RPC Funnel Stage | Punya kelas/event &gt;14 hari belum publish, DAN terindikasi "masih aktif mengelola" | Heuristik "masih rutin update" perlu definisi konkret saat implementasi: rekomendasi `classes.updated_at` ATAU `sessions` baru dibuat dalam 7 hari terakhir untuk kelas yang sama — **butuh validasi terhadap data nyata sebelum dikirim ke operator** (bukan langsung siap kirim, lihat catatan di bawah) | **Sedang-Tinggi** — heuristik belum pernah diuji terhadap pola pemakaian instruktur sungguhan, risiko false-positive tidak terukur sampai dicoba |
| Registrasi lewat tanggal sesi, presensi kosong | `registrations`, `session_date`/`event_date`, `attendance` | Tanggal sesi sudah lewat, registrasi confirmed, nol attendance terkait | Query langsung, **WAJIB tambah mekanisme dedup**: tandai `seen_at`/`dismissed_at` per item (butuh state penyimpanan kecil — lihat Part G) supaya item yang sama tidak terus muncul tiap hari | Rendah secara data, tapi **operasional sedang** tanpa dedup (nagging) |
| WA Disconnected | — | — | **DITUNDA ke Phase 2** sesuai keputusan terkunci, butuh migrasi histori koneksi dulu | — |

**Yang siap kirim segera (zero groundwork tambahan selain query)**: Trial-ending (kedua varian), Pending Registration, Membership Awaiting Attendance.
**Yang butuh groundwork sebelum dianggap "selesai"**: Stuck Go-Live (validasi heuristik), Registrasi-lewat-tanggal (butuh mekanisme dedup/state).

---

## Part G — Strategi Migrasi

| Item | Klasifikasi | Alasan |
|---|---|---|
| RPC Health Tier | **Function/View Only** | Replikasi pola `compute_business_activity_status()` — fungsi baca-saat-itu, tidak menyimpan apa pun |
| RPC Funnel Stage | **Function/View Only** | Sama pola, agregasi dari tabel existing |
| Query Subscription Monitoring (MRR normalisasi) | **No Migration** | Query langsung di kode aplikasi, tidak perlu jadi RPC database |
| Query Product Adoption breadth | **No Migration** | Sama, query aplikasi |
| Alert Pending Registration / Membership Awaiting (dengan rollup) | **Function/View Only** | View/RPC agregasi `GROUP BY user_id`, tidak menyimpan state |
| Dedup/snooze untuk alert "registrasi lewat tanggal" | **Table Change (kecil)** | Butuh kolom penyimpanan state minimal (mis. `dismissed_at` di tabel baru kecil ATAU kolom baru di `registrations`) — satu-satunya item Phase 1 yang menyentuh skema sama sekali, dan itu pun opsional (bisa ditunda kalau dedup mau ditangani murni di sisi UI/local-state dulu untuk versi paling awal) |
| `auth.users.last_sign_in_at` exposure | **Function/View Only** (Phase 2) | View tipis di atas `auth.users`, tidak mengubah tabel apa pun |
| Histori koneksi WA (`bot_connected_at`/`disconnected_at`) | **Table Change** (Phase 2) | `ALTER TABLE profiles ADD COLUMN` — kecil, additive |
| `admin_audit_log` | **New Table** (Phase 2, gated admin&gt;1) | Tabel baru, tapi tidak genting untuk V1 |
| `is_platform_admin` RLS gating | **Table Change** (policy, Phase 2, gated admin&gt;1) | Perubahan policy, bukan tabel baru |
| Pagination/virtualization Customer List | **No Migration** | Murni engineering frontend/query pagination, bukan perubahan skema |

**Prinsip dipegang**: dari seluruh Phase 1, **nol migrasi wajib** kecuali satu item kecil-opsional (dedup state untuk satu alert, dan itu pun bisa ditunda). Semua migrasi nyata (3 item) ada di Phase 2, semuanya additive (ALTER TABLE/CREATE TABLE baru), tidak ada satu pun yang mengubah data/perilaku existing.

---

## Part H — Urutan Build

### Phase 1 — Fondasi RPC, lalu UI di atasnya (nol migrasi wajib)

1. RPC Funnel Stage (sadar-jalur, termasuk bucket "Membership Awaiting Attendance") — **fondasi, semua bergantung ke ini**
2. RPC Health Tier (4 tier, broadcast dikecualikan, hanya jalan untuk instruktur Activated) — bergantung ke #1 (perlu tahu siapa Activated)
3. Kolom Status (gabungan) + Last Activity di Customer List — bergantung ke #1+#2
4. Section Customer Funnel + Customer Health di dashboard (agregat dari #1/#2) — bergantung ke #1+#2
5. Subscription Monitoring (gabungkan counts dari Business Overview, MRR ternormalisasi) — independen, bisa paralel dengan #1-4
6. Business Overview ditrim (hapus duplikasi) — bergantung ke #5 selesai dulu (supaya tidak ada window kosong data)
7. Alert Trial-ending (2 varian) — bergantung ke #1 (butuh tahu status Activated untuk prioritas)
8. Alert Pending Registration (rollup) — independen, bisa paralel
9. Alert Membership Awaiting Attendance (rollup) — independen, bisa paralel, atau reuse logika dari #1 (bucket sudah dihitung di RPC Funnel)
10. Kolom Pending Items di Customer List — bergantung ke #8+#9
11. WhatsApp Connectivity section (breakdown agregat) — independen
12. Product Adoption section + per-instruktur summary di Customer Detail — bergantung ke #1 (perlu populasi Activated sebagai pembagi persentase)
13. Customer Detail: Status Summary, Onboarding Checklist, Activity Timeline — bergantung ke #1+#2
14. Needs Attention inbox final (gabung semua alert #7-9 + antrian existing, urutan prioritas manual) — bergantung ke semua alert selesai
15. Alert Stuck Go-Live — **terakhir di Phase 1**, karena butuh validasi heuristik dulu (lihat Part F) sebelum dianggap matang dikirim ke operator
16. Alert Registrasi-lewat-tanggal + mekanisme dedup — bisa di mana saja setelah #1, tidak ketat bergantung ke item lain

### Phase 2 — Migrasi kecil

1. View `auth.users.last_sign_in_at`
2. Kolom histori koneksi WA (`bot_connected_at`/`disconnected_at`) → baru setelah ini, alert WA Disconnected bisa dibangun (sesuai keputusan terkunci: ditunda sampai sini)
3. `admin_audit_log` (gated: hanya kalau admin FitFlow bertambah)
4. `is_platform_admin` RLS gating (gated: sama)
5. Pagination/virtualization Customer List (gated: hanya kalau jumlah instruktur mendekati ~100)

### Future
1. Alert berbasis tren (lonjakan registrasi, penurunan revenue) — setelah cukup histori
2. Funnel chart per-jalur terpisah (3 mini-funnel)
3. Notifikasi proaktif (WA/email) untuk alert kritis
4. Drill-down detail per milestone di Customer Detail

---

## Part I — Risk Assessment

| Risiko | Kategori | Likelihood | Impact | Mitigasi |
|---|---|---|---|---|
| RPC Health/Funnel dipanggil N+1 per baris alih-alih satu query agregat | Performance | Sedang | Tinggi (lambat drastis begitu &gt;50 instruktur) | Wajibkan satu query `GROUP BY`/view materialized-ready sejak awal, sudah ditegaskan di Part C sebagai syarat bukan saran |
| Heuristik "masih rutin update" untuk Stuck-Go-Live ternyata tidak akurat di data nyata | Data Quality | Sedang | Sedang (alert salah tembak, tapi sudah di-scope Jalur-A-saja jadi dampaknya terbatas) | Validasi heuristik terhadap data instruktur nyata SEBELUM alert ini aktif untuk operator (ditandai eksplisit di Part F/H sebagai langkah terakhir, bukan langkah pertama) |
| Alert Pending Registration tanpa rollup ter-deploy duluan (implementer lupa syarat rollup) | Alert Fatigue | Rendah-Sedang | Tinggi (langsung mereproduksi risiko yang baru saja diperbaiki) | Rollup eksplisit ditulis sebagai syarat WAJIB, bukan catatan kaki, di Part F |
| Broadcast diam-diam ikut lagi di kode lain (mis. di Activity Timeline) sebagai sinyal kesehatan implisit | Data Quality / Maintenance | Sedang | Sedang | Part E eksplisit menulis "boleh muncul di timeline TAPI tidak diprioritaskan" — implementer harus tahu ini bukan sinyal Health, hanya catatan riwayat |
| Dua RPC baru (Health, Funnel) didefinisikan ulang logikanya secara berbeda di waktu berbeda oleh orang berbeda (drift dari dokumen ini) | Maintenance | Sedang | Sedang | Satu RPC per konsep, dipanggil dari semua tempat yang butuh (dashboard, list, detail) — JANGAN reimplementasi logika yang sama di query terpisah-pisah |
| Volume instruktur tumbuh lewat ~100 sebelum pagination Phase 2 selesai | Performance | Rendah saat ini, naik seiring waktu | Sedang | Sudah ditandai gated-trigger di Part H — pantau jumlah baris, bukan tunggu sampai benar-benar lambat baru bereaksi |
| Alert "registrasi lewat tanggal" tanpa dedup ter-deploy sebelum mekanisme snooze siap | Alert Fatigue | Sedang (kalau urutan Part H dilanggar) | Sedang | Build order Part H menempatkan dedup sebagai bagian dari item yang sama, bukan item terpisah yang bisa "lupa" |
| `member_memberships` test/dummy (Case B dari review Aktivasi) ikut kehitung di Product Adoption metrics dan bikin angka adopsi terlihat lebih tinggi dari kenyataan | Data Quality | Rendah-Sedang | Rendah | Sudah diterima sebagai trade-off di keputusan Aktivasi (Membership Sale tetap valid sebagai sinyal Product Adoption meski rentan Case B) — bukan risiko baru, hanya diwariskan, tidak perlu mitigasi tambahan di V1 |

---

## Part J — Final Recommendation

### 1. Recommended Scope untuk V1 Launch
Seluruh **Phase 1** di Part H (item 1-16), MINUS Stuck-Go-Live alert yang baru aktif setelah heuristiknya divalidasi (bisa dibangun di Phase 1 tapi jangan AKTIF ke operator sampai tervalidasi). Semua item lain Phase 1 aman untuk langsung dipakai live karena logikanya jelas, dideterminasi langsung dari data, tidak ada heuristik buram.

### 2. Items to Defer
- WA Disconnected alert → Phase 2 (sudah terkunci)
- `admin_audit_log`, `is_platform_admin` RLS → Phase 2, gated admin&gt;1
- Pagination Customer List → Phase 2, gated jumlah baris
- Trend-based alerts, funnel per-jalur terpisah, notifikasi proaktif → Future
- Drill-down detail per milestone → Future

### 3. Estimasi Kompleksitas (relatif, bukan jam/poin)

| Workstream | Ukuran |
|---|---|
| RPC Funnel Stage | **Sedang** — logika sadar-jalur paling rumit di seluruh rencana ini |
| RPC Health Tier | **Sedang** — lebih sederhana dari Funnel (4 kondisi eksplisit, bukan percabangan jalur) |
| Dashboard sections (Overview/Health/Funnel/Subscription/Adoption/WA) | **Kecil-Sedang per section**, sebagian besar query+stat card sederhana di atas 2 RPC inti |
| Customer List (kolom+filter+sort) | **Kecil-Sedang** | 
| Customer Detail additions | **Sedang** — paling banyak section baru sekaligus (4 section) tapi semua read-only |
| Alerts (5 yang siap kirim + 1 yang butuh validasi) | **Sedang**, mayoritas kecil per-alert, kompleksitas datang dari rollup+dedup, bukan dari logika triggernya |

### 4. Critical Path
**RPC Funnel Stage → RPC Health Tier → (paralel) Customer List Status column + Dashboard Funnel/Health sections + Customer Detail Status Summary/Checklist.**

Semua jalur lain di Part H (Subscription Monitoring, WA Connectivity, alert-alert individual) **tidak bergantung pada dua RPC ini** dan bisa dikerjakan PARALEL sejak hari pertama — bottleneck sebenarnya hanya di dua RPC fondasi, bukan di seluruh rencana. Item yang paling boleh terlambat tanpa mengganggu apa pun: Stuck-Go-Live (sengaja ditaruh terakhir, butuh validasi) dan seluruh Phase 2 (gated kondisi, bukan tanggal).

---

## Ringkasan Eksekutif

- Implementasi V1 secara teknis adalah **dua RPC baru + assembly UI di sekelilingnya** — bukan proyek besar. Pola arsitekturnya bukan hal baru, mereplikasi langsung preseden `compute_business_activity_status`/`recompute_member_last_attended` yang sudah terbukti jalan di level member.
- **Nol migrasi wajib untuk Phase 1** (satu item dedup-state kecil bersifat opsional, bisa ditunda ke versi UI-only dulu).
- Satu-satunya alert yang TIDAK siap langsung dikirim ke operator adalah Stuck-Go-Live — heuristiknya butuh divalidasi dulu terhadap data nyata, bukan ditebak dari desain di atas kertas.
- Critical path-nya pendek: dua RPC fondasi, semua yang lain bisa paralel.
- Risiko paling nyata bukan di data atau desain, tapi di **disiplin implementasi**: kalau syarat rollup-per-instruktur atau syarat exclude-broadcast tidak diikuti persis seperti yang tertulis di review sebelumnya, risiko yang sudah diperbaiki di kertas bisa kembali muncul di kode.
