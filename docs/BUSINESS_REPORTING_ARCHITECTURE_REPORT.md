# Business Reporting Architecture Report

**Tanggal**: 2026-06-28
**Status**: Audit & desain arsitektur — TIDAK ADA kode/migrasi/UI yang dibuat dari dokumen ini. Murni untuk pengambilan keputusan sebelum implementasi.

---

## 1. Kondisi Saat Ini

### 1.1 Halaman Laporan hari ini
`src/app/(dashboard)/laporan/page.tsx` — Revenue Report sederhana, scope bulan ini (hardcoded, tidak ada pilihan periode):
- Total revenue bulan ini
- Breakdown 4 sumber: Event, Kelas, Membership, Walk-in
- Top 5 Event by revenue, Top 5 Kelas by revenue
- Definisi revenue sudah benar (pakai `confirmed_at IS NOT NULL`, fakta historis — hasil fix migrasi 044 & disatukan dengan Beranda di migrasi 046)

### 1.2 Inventaris Data per Domain

| Domain | Tabel/View Utama | Sudah di Laporan? | Sudah di Beranda? | Trust Level | Catatan Kunci |
|---|---|---|---|---|---|
| **Revenue** | `registrations`, `member_memberships`, `attendance`, `event_registration_summary`, `class_registration_summary` | Ya (4 sumber) | Ya (RPC) | **MEDIUM** | Bug 044: backfill `confirmed_at` pakai proxy `registered_at`, bisa beda beberapa jam. Pembayaran cash auto-confirm tanpa verifikasi bukti (honor system). |
| **Class** | `classes`, `sessions`, `registrations` | Sebagian (top 5) | Ya (list) | **MEDIUM** | Tidak ada occupancy rate tersimpan. Capacity check via RPC (047) rentan race condition kalau ada insert langsung di luar RPC. |
| **Event** | `events`, `registrations`, `event_registration_summary` | Ya (top 5) | Ya (list) | **MEDIUM** | Registrasi SEBELUM migrasi 045 (fix P0) mungkin melanggar kuota/deadline early-bird — tidak ada cleanup data historis. |
| **Membership** | `membership_packages`, `member_memberships` | Ya (purchase_price) | Sebagian (total saja) | **MEDIUM** | Belum ada auto-deduction sesi terpakai. Antrian status `pending` tidak terbatas. |
| **Walk-in** | `attendance` (source='walkin') | Ya | Tidak | **LOW** | Input manual nama/HP, tidak ada validasi/dedup. Konsistensi kolom `source` tidak dijamin (instruktur bisa salah catat sebagai member). |
| **Member** | `members`, `member_summary` | Tidak (cuma at-risk) | Ya (at-risk list) | **MEDIUM** | Status cuma snapshot dari `last_attended_at` — kalau attendance dihapus, status reset, tidak ada audit trail perubahan status. |
| **Attendance** | `attendance`, `attendance_summary` | Sebagian (walkin saja) | Ya (count hari ini) | **LOW** | **Tidak ada FK ke `registrations`** — mustahil hitung no-show rate hari ini tanpa perubahan skema. Data pre-migrasi 026 tidak diklasifikasi ulang. |
| **Community** | `community_contacts`, `class_type_benefits` | Tidak sama sekali | Tidak | **HIGH** | Data bersih, RLS standar. `converted_member_id` SUDAH ADA untuk tracking konversi ke member — cuma belum pernah dipakai di laporan apa pun. |
| **Broadcast** | `broadcasts`, `broadcast_recipients` | Tidak sama sekali | Tidak | **HIGH** | Status per-penerima (`sent`/`failed`) sudah tercatat rapi, fungsi `checkBroadcastQuota()` sudah ada — tinggal belum pernah ditampilkan. |
| **WhatsApp Bot** | `wa_conversations` | Tidak sama sekali | Tidak | **HIGH** (data bersih) tapi **ZERO reporting** | Tabel append-only log percakapan. Tidak ada satu pun agregasi volume pesan/handover rate di seluruh codebase. Hasil klasifikasi handover juga tidak disimpan (transient). |
| **Subscription** | `profiles` (plan_name dst), `payments` | Tidak | Tidak (limit doang, bukan usage) | **HIGH** | Limit paket terlihat instruktur, tapi **pemakaian bulan ini (X/Y kelas, X/Y broadcast) tidak pernah ditampilkan ke instruktur** — cuma dipakai untuk blokir di backend. |

### 1.3 Temuan Arsitektur Paling Kritis: TIDAK ADA Konsep Studio Sama Sekali

Diverifikasi langsung lewat seluruh 51 migrasi dan semua `CREATE POLICY` di database:

- **Tidak ada kolom `studio_id`/`organization_id`/`tenant_id`/`parent_id` yang pernah dibuat**, di tabel mana pun, di migrasi mana pun.
- Setiap tabel utama (`classes`, `events`, `members`, `registrations`, `payment_profiles`, `broadcasts`, `community_contacts`, dst) di-scope murni lewat `user_id` + RLS `auth.uid() = user_id`. Satu instruktur = satu akun = satu "pulau data" yang terisolasi total.
- `is_platform_admin` cuma flag biner (admin platform vs instruktur biasa) — bukan hierarki organisasi. Tidak ada satu pun policy yang membaca data instruktur lain.

**Implikasi**: mode "Studio dengan banyak instruktur" BUKAN pekerjaan UI/laporan saja — itu perubahan skema fundamental yang menyentuh hampir semua tabel inti. Ini bukan sesuatu yang bisa "disiapkan diam-diam" lewat desain laporan saja; ini keputusan arsitektur terpisah yang harus diambil secara eksplisit sebelum laporan level-Studio bisa eksis.

---

## 2. Visi Laporan Jangka Panjang: A atau B?

**Jawaban: B (Business Intelligence Dashboard) sebagai arah jangka panjang — tapi bukan dalam arti "bikin UI kompleks sekarang".**

Argumentasi: perbedaan A vs B yang sebenarnya penting bukan soal seberapa banyak grafik yang ditampilkan ke instruktur HARI INI. Instruktur solo tetap butuh laporan yang simpel dan actionable, bukan dashboard BI yang penuh angka. Yang sebenarnya menentukan masa depan adalah **bagaimana metrik itu DIHITUNG di backend**:

- Laporan hari ini: 1 halaman, query ad-hoc inline, dihitung khusus untuk SATU `user_id` yang sedang login. Kalau nanti ada Studio dengan 5 instruktur, halaman ini tidak bisa "dijumlahkan" — harus ditulis ulang dari nol.
- Kalau metrik-metrik ini dari awal ditulis sebagai **fungsi/RPC yang menerima `user_id` sebagai parameter** (bukan inline di komponen halaman), maka laporan level-Studio nanti tinggal: panggil fungsi yang sama untuk tiap instruktur dalam studio, lalu jumlahkan hasilnya. Bukan menulis ulang logika.

Jadi rekomendasinya: **visi B, implementasi tetap sesederhana A untuk sekarang** — tapi pondasi kodenya (bagaimana query/RPC ditulis) harus disusun seolah-olah multi-instruktur sudah ada, walau saat ini cuma dipakai oleh 1 instruktur. Ini satu-satunya keputusan arsitektur yang murah dilakukan SEKARANG dan mahal diperbaiki NANTI.

---

## 3. Business Metrics Inventory

Status: ✅ Tersedia langsung | 🔧 Perlu query baru (data mentah sudah ada) | ❌ Tidak ada data sama sekali (perlu perubahan skema)

### Revenue
| Metrik | Status |
|---|---|
| Revenue bulan ini | ✅ |
| Revenue bulan lalu / periode custom | 🔧 (hardcoded ke bulan ini, tinggal lepas) |
| Growth % MoM | 🔧 (derivasi dari 2 baris di atas) |
| Revenue by metode bayar (Cash vs Transfer) | 🔧 (`payment_method` sudah ada di `registrations`) |
| Revenue by Payment Profile | 🔧 |
| Pending/outstanding revenue (belum confirmed) | 🔧 |
| Revenue per instruktur (untuk Studio nanti) | ❌ (instruktur tunggal SUDAH bisa, tapi rollup butuh konsep Studio) |

### Member
| Metrik | Status |
|---|---|
| Total member | ✅ |
| Member baru bulan ini | ✅ |
| Member aktif/at-risk/inactive (jumlah, bukan cuma list) | ✅ (data ada, cuma belum ditampilkan agregat di Laporan) |
| Lifetime value (LTV) per member | 🔧 (perlu gabung attendance + membership + registrasi kelas/event per member, belum ada rollup tunggal) |
| Retention / churn rate | ❌ (status cuma snapshot, tidak ada riwayat perubahan status dari waktu ke waktu) |

### Class
| Metrik | Status |
|---|---|
| Total attendance | ✅ |
| Top kelas by revenue | ✅ |
| Top kelas by volume kehadiran | 🔧 |
| Occupancy rate (kapasitas vs realisasi) | 🔧 (data mentah ada, belum pernah dihitung) |
| No-show rate (terdaftar tapi tidak hadir) | ❌ (tidak ada FK antara `attendance` dan `registrations` — mustahil dihitung tanpa migrasi skema) |

### Event
| Metrik | Status |
|---|---|
| Revenue | ✅ |
| Jumlah peserta | ✅ |
| Mix Early Bird vs OTS | 🔧 (kolom `tier` sudah ada, belum diagregasi) |
| Conversion rate (pengunjung halaman → daftar) | ❌ (tidak ada page-view tracking di mana pun di aplikasi) |

### Community
| Metrik | Status |
|---|---|
| Total kontak | ✅ |
| Pertumbuhan kontak per bulan | 🔧 |
| **Konversi ke Member** | 🔧 — kolom `converted_member_id` SUDAH ADA persis untuk ini, cuma belum pernah dipakai di laporan mana pun. Quick win nyata. |

### Marketing (Broadcast & WA Bot)
| Metrik | Status |
|---|---|
| Broadcast delivery rate (sent/failed) | 🔧 (`broadcast_recipients.status` sudah tercatat rapi) |
| Pemakaian kuota broadcast bulan ini | 🔧 (fungsi `checkBroadcastQuota()` sudah ada, tinggal ditampilkan) |
| Volume pesan WA bot | 🔧 (bisa dihitung dari `wa_conversations`, belum pernah diagregasi) |
| Handover rate (% chat diteruskan ke instruktur) | ❌ (hasil klasifikasi handover bersifat transient, tidak pernah disimpan ke DB) |

### Operations
| Metrik | Status |
|---|---|
| Pemakaian kuota kelas aktif (X/Y) ke instruktur sendiri | 🔧 (fungsi `checkClassQuota()` ada, cuma untuk enforcement, tidak pernah ditampilkan sebagai info) |
| Session completion rate | ❌ (kolom status sesi ada di skema, tapi belum dikonfirmasi apakah benar-benar dipakai konsisten — perlu verifikasi terpisah sebelum dipakai sebagai metrik) |

---

## 4. Struktur Laporan — Level Instruktur (sekarang)

Apa yang instruktur solo ingin tahu, urut dari paling sering ditanya:
1. **Berapa uang masuk bulan ini, dari mana** — sudah ada, pertahankan
2. **Lebih baik atau lebih buruk dari bulan lalu** — belum ada (gap #1 di audit sebelumnya)
3. **Kelas/event mana yang paling laku** — sudah ada
4. **Berapa uang yang masih "menunggu" (belum confirmed)** — belum ada, padahal datanya sudah tersedia
5. **Member mana yang butuh di-follow-up** — ada tapi cuma di Beranda, idealnya juga muncul di Laporan sebagai angka (bukan cuma di dashboard widget)
6. **Kuota paket saya sudah kepake berapa** — sama sekali belum ada self-service view, padahal fungsinya sudah ada untuk enforcement

## 5. Struktur Laporan — Level Studio (nanti, setelah keputusan arsitektur diambil)

Berbeda fundamental dari level instruktur — ini soal **perbandingan & rollup antar instruktur**, bukan cuma "lebih banyak angka":
1. Total revenue seluruh studio (jumlah dari semua instruktur)
2. Revenue per instruktur — ranking, bukan cuma total (siapa kontribusi terbesar)
3. Total member/kelas/event lintas studio
4. Perbandingan performa antar instruktur (occupancy, revenue per kelas, dst)
5. Pertumbuhan komunitas studio secara keseluruhan
6. (Lihat §6) Biaya operasional studio — kemungkinan besar shared cost (sewa, gaji helper), bukan per-instruktur

**Prasyarat keras**: tidak satu pun dari ini bisa dibangun sebelum keputusan skema Studio diambil (lihat §1.3). Mendesain UI laporan Studio sekarang, sebelum keputusan itu, berisiko membangun di atas asumsi yang salah.

---

## 6. Evaluasi: Expense Tracking via WhatsApp

**Konsep**: instruktur kirim pesan bebas seperti "belanja plastik 50k" atau "gaji helper 100k" ke bot, bot otomatis parse nominal + kategori, catat sebagai expense.

**Apakah cocok dengan roadmap FitFlow?** Ya — ini justru sangat konsisten dengan DNA produk: bot WA sudah jadi kanal utama untuk data masuk (registrasi, broadcast respon, dst), jadi memperluas ke expense input lewat kanal yang sama itu instinct yang benar, bukan fitur asing.

**Kapan waktu yang tepat?** **Setelah** Quick Wins & Medium (§7) selesai, BUKAN sebelumnya. Alasan: expense tracking adalah kemampuan BARU yang menambah luas, sementara fondasi revenue reporting yang SUDAH ADA masih punya gap trust-level LOW (Walk-in, Attendance) yang lebih mendesak diperbaiki dulu. Membangun fitur baru di atas fondasi yang belum stabil cuma menambah utang.

**Modul terpisah atau menyatu?** **Modul terpisah** — tabel `expenses` baru, logic parsing sendiri di route WA bot (bisa reuse pola `classifyHandover` yang sudah ada — itu sudah membuktikan Claude bisa dipakai untuk klasifikasi singkat dari teks bebas). Tapi **hasilnya menyatu** ke halaman Laporan yang sama, sebagai section baru "Pengeluaran" dan kalkulasi "Net Profit" (Revenue − Expense). Pola ini sama dengan bagaimana `community_contacts`/`broadcasts` adalah tabel terpisah yang tetap muncul di laporan yang sama.

**Risiko desain yang perlu diantisipasi**: kategorisasi otomatis dari teks bebas ("plastik" = supplies? "gaji helper" = payroll?) akan sering salah tebak. Rekomendasi: bot cuma menangkap nominal + teks asli + tebakan kategori, instruktur bisa koreksi kategori lewat dashboard (pola koreksi seperti ini sudah ada di tempat lain di aplikasi, mis. error-correction di broadcast).

**Pengaruh ke mode Studio nanti**: kalau Studio jadi nyata, expense seperti sewa/gaji helper kemungkinan SHARED across instruktur dalam satu studio, bukan per-instruktur seperti revenue. Untuk sekarang, scope expense tetap per-`user_id` seperti tabel lain — re-atribusi ke level studio akan jadi bagian dari migrasi Studio itu sendiri nanti, bukan beban desain sekarang.

---

## 7. Gap Analysis & Roadmap Bertahap

### Quick Wins (< 1 hari, tanpa perubahan skema)
- Filter periode/bulan di Laporan (lepas hardcode `monthStart`)
- Card "Pending/Outstanding Revenue" (sum `payment_status='pending'`)
- Ringkasan jumlah Member (total/baru/aktif/at-risk/inactive) di Laporan, bukan cuma di Beranda
- Section "Komunitas" di Laporan: total kontak + pertumbuhan bulan ini + jumlah konversi ke member (data `converted_member_id` sudah ada, tinggal dipakai)
- Section "Broadcast" di Laporan: jumlah terkirim/gagal bulan ini
- Tampilkan pemakaian kuota (kelas aktif, broadcast) ke instruktur sendiri — fungsi enforcement-nya sudah ada

### Medium (< 1 sprint, query/agregasi baru, tanpa migrasi skema besar)
- Breakdown revenue by metode bayar & by Payment Profile
- Occupancy rate per kelas (kapasitas vs realisasi)
- Member LTV (rollup attendance + membership + registrasi per member)
- Grafik tren revenue 6 bulan terakhir
- Export CSV untuk Laporan

### Major Features (roadmap, butuh keputusan eksplisit sebelum mulai)
- **Keputusan skema Studio/Organization** — fork-in-the-road, harus diputuskan dulu sebelum apa pun di §5 dikerjakan
- Laporan rollup level-Studio (bergantung penuh ke poin di atas)
- Link `attendance` ↔ `registrations` (untuk no-show rate — butuh migrasi skema)
- Tabel riwayat status member (untuk retention/churn rate sungguhan, bukan snapshot)
- **Expense tracking via WhatsApp** (lihat §6 — modul baru, sengaja ditaruh di tier ini, bukan Quick Win)
- Reporting engagement WA bot (volume pesan, handover rate — perlu juga mulai menyimpan hasil klasifikasi handover, bukan dibuang)

---

## 8. Rekomendasi Akhir

1. **Visi**: BI Dashboard (B) sebagai arah, tapi cukup bangun laporan sederhana untuk sekarang — kuncinya tulis metrik baru sebagai fungsi/RPC ber-parameter `user_id`, bukan query inline di halaman. Ini satu-satunya keputusan yang murah sekarang, mahal nanti.
2. **Jangan bangun skema Studio secara spekulatif sekarang** — belum ada permintaan nyata, dan ini perubahan besar ke hampir semua tabel inti. Tapi tulis SEMUA query laporan baru dengan kesadaran ini (parameterized by instructor, composable), supaya saat keputusan Studio diambil, laporan instruktur tidak perlu ditulis ulang — cukup di-loop dan dijumlahkan.
3. **Urutan kerja**: Quick Wins dulu (murah, langsung kelihatan, nol risiko skema) → Medium → Major (Major butuh go-ahead eksplisit, terutama keputusan Studio).
4. **Expense via WhatsApp**: ide bagus dan on-brand, tapi taruh SETELAH Quick Wins/Medium selesai, sebagai modul terpisah yang feed ke Laporan yang sama.
5. **Perbaiki data trust-level LOW dulu (Walk-in, Attendance) sebelum membangun laporan yang lebih canggih di atasnya** — laporan cantik di atas data yang tidak bisa dipercaya cuma menghasilkan angka yang kelihatan yakin tapi salah, itu lebih berbahaya daripada tidak ada laporan sama sekali. Ini juga menyambung ke temuan lama yang belum selesai: definisi revenue Beranda vs Laporan harus benar-benar disatukan sebagai satu sumber kebenaran, bukan cuma "kelihatan sama" secara kebetulan.
