# Laporan V2 — Business Report Design Report

**Tanggal**: 2026-06-28
**Status**: Desain produk & audit data — TIDAK ADA kode/migrasi/UI dibuat dari dokumen ini.
**Keputusan yang sudah diambil** (konteks dari user): tidak refactor ke Studio Model sekarang, tidak ubah ownership model, tidak ada Instructor Mode vs Studio Mode. Tetap pakai model satu-instruktur-satu-akun yang ada — tapi desain laporan harus tahan terhadap "1 Business = 1 atau banyak Instruktur" di masa depan, tanpa redesign besar.

Dokumen ini melanjutkan `docs/BUSINESS_REPORTING_ARCHITECTURE_REPORT.md` (audit arsitektur sebelumnya) — detail verifikasi skema/trust-level/migrasi ada di sana, tidak diulang penuh di sini. Dokumen ini fokus ke **desain produk: struktur halaman Laporan V2 + roadmap bertahap**.

---

## 1. Audit Data (ringkasan — detail lengkap di laporan sebelumnya)

| Domain | Tabel/View | Trust Level | Siap Dipakai? |
|---|---|---|---|
| **Revenue** | `registrations`, `member_memberships`, `attendance`, `event_registration_summary`, `class_registration_summary` | MEDIUM | Ya, sudah dipakai (Laporan V1) |
| **Member** | `members`, `member_summary` | MEDIUM | Sebagian (cuma at-risk count di Beranda) |
| **Community** | `community_contacts`, `class_type_benefits` | HIGH | Data bersih, **belum pernah dipakai di laporan** |
| **Classes** | `classes`, `sessions`, `registrations` | MEDIUM | Sebagian (top 5 revenue saja) |
| **Events** | `events`, `registrations`, `event_registration_summary` | MEDIUM | Sebagian (top 5 revenue saja) |
| **Attendance** | `attendance`, `attendance_summary` | **LOW** | Cuma walk-in revenue; tidak ada FK ke `registrations` (no-show rate mustahil tanpa migrasi) |
| **Broadcast** | `broadcasts`, `broadcast_recipients` | HIGH | Data bersih, **belum pernah dipakai di laporan** |
| **WhatsApp Bot** | `wa_conversations` | HIGH (data bersih) tapi **zero reporting infrastructure** | Tidak ada satu pun agregasi yang pernah dibangun; hasil klasifikasi handover bersifat transient (tidak disimpan) |
| **Subscription** | `profiles`, `payments` | HIGH | Limit terlihat, **pemakaian bulan ini tidak pernah ditampilkan ke instruktur** |

**Catatan arsitektur yang tetap berlaku** (sudah diverifikasi sebelumnya, tidak berubah oleh keputusan "tidak refactor sekarang"): tidak ada kolom `studio_id`/`organization_id` di mana pun. Setiap query yang ditulis untuk Laporan V2/V3 **harus** diparameterisasi oleh `user_id` (fungsi/RPC, bukan query inline per-halaman) — ini satu-satunya cara desain hari ini tetap valid kalau nanti benar-benar ada multi-instruktur, tanpa menyentuh skema sekarang.

---

## 2. Struktur Halaman Laporan V2 *(revisi setelah feedback 2026-06-28)*

Urutan section, disusun berdasarkan **kesiapan data real** (bukan asumsi) DAN **actionability** (lihat keputusan baru: Action Required lebih penting daripada grafik historis). Setiap section di bawah ini dipetakan ke pertanyaan owner spesifik — lihat §2A untuk tabel lengkapnya.

### 2.0 Business Health Score *(BARU, paling atas — di atas Ringkasan Bisnis)*
Jawaban cepat untuk "bisnis saya sehat atau tidak?", tanpa AI — cukup indikator sederhana berdampingan:
- Revenue bulan ini vs bulan lalu (naik/turun, dengan %)
- Member baru bulan ini
- **Member hilang** — didefinisikan sebagai member yang hadir bulan lalu tapi TIDAK hadir bulan ini. Ini terhitung langsung dari `attendance.created_at` per `member_id` tanpa perlu tabel riwayat status — lebih sederhana dan lebih akurat dari sekadar baca kolom `status` snapshot.
- Occupancy rata-rata (across semua kelas aktif)
- Pending payment (jumlah & nominal)
- Jumlah member at-risk

### 2.0.1 Action Required *(BARU — section paling actionable, ditaruh tepat di bawah Business Health)*
Bukan grafik masa lalu, tapi daftar hal yang butuh tindakan SEKARANG:
- ⚠ N pembayaran belum dikonfirmasi (link ke daftar)
- ⚠ N member berstatus at-risk (link ke daftar)
- ⚠ N kelas minggu depan masih kosong < 30% (hitung dari sesi minggu depan: registrasi/attendance vs capacity)
- ⚠ Trial/subscription berakhir N hari lagi (kalau ≤ 7 hari)

Semua item ini sudah computable dari data yang ada, tanpa migrasi.

### 2.1 Ringkasan Bisnis
Kartu ringkas pelengkap Business Health (detail angka, bukan status sehat/tidak):
- Total revenue bulan ini (angka penuh)
- Total Member aktif
- Kuota terpakai bulan ini (kelas aktif, broadcast) — ringkas, link ke detail di section Operasional

### 2.2 Keuangan
Section terkuat (data paling matang), perluasan dari Laporan V1:
- Total revenue + breakdown 4 sumber (sudah ada)
- **Baru**: pilihan periode (bulan ini/lalu/custom — lepas hardcode)
- **Baru**: pending/outstanding revenue (belum confirmed) — detail di sini, ringkasannya sudah muncul di Business Health
- **Baru**: breakdown by metode bayar (Cash vs Transfer) & by Payment Profile
- Top 5 Kelas, Top 5 Event by revenue (sudah ada)

### 2.3 Member
- Total / baru bulan ini / aktif / at-risk / inactive (jumlah, bukan cuma list at-risk seperti di Beranda)
- **Baru — Member Baru vs Member Lama** (prioritas di atas repeat-attendance frequency, per feedback): pecah total member aktif jadi "baru bulan ini" vs "lama yang masih bertahan" — ini jawab pertanyaan pertumbuhan bisnis datang dari AKUISISI atau RETENSI, lebih actionable daripada distribusi frekuensi hadir
- Repeat attendance (1x/2-4x/5x+) tetap ditambahkan, tapi sebagai detail sekunder bukan headline

### 2.4 Kelas
- **Baru**: occupancy rate per kelas (kapasitas vs realisasi)
- Top kelas by revenue (sudah ada, dipindah render-nya ke sini bukan di Keuangan — lebih relevan sebagai metrik operasional kelas)
- **Baru**: top kelas by volume kehadiran (beda dari top by revenue — kelas murah/gratis yang ramai tidak kelihatan di ranking revenue)

### 2.5 Komunitas *(diperluas signifikan per feedback — ini aset besar, bukan section kecil)*
Community adalah corong penjualan (sales funnel), bukan sekadar daftar kontak — tetap relevan walau nanti Studio dibangun:
- Total kontak komunitas
- Kontak baru bulan ini
- **Sudah jadi Member** (`converted_member_id IS NOT NULL`)
- **Belum jadi Member** (`converted_member_id IS NULL`) — ini funnel yang belum closing, paling actionable

### 2.6 Event
- Jumlah peserta per event
- Mix Early Bird vs OTS (kolom `tier` sudah ada, belum diagregasi)

### 2.7 Marketing *(section baru — Broadcast)*
- Jumlah broadcast terkirim/gagal bulan ini
- Pemakaian kuota broadcast

### 2.8 Operasional *(section baru — paling bawah, info housekeeping)*
- Pemakaian kuota paket (kelas aktif X/Y, broadcast X/Y)
- Status subscription (trial/aktif, tanggal expire)

**Catatan desain**: Attendance secara sengaja TIDAK jadi section sendiri — datanya cross-cutting, dipecah masuk ke Member (repeat attendance) dan Kelas (occupancy). WhatsApp Bot juga sengaja TIDAK masuk V2 sama sekali — lihat §6, datanya nol infrastruktur, bukan sekadar "belum ditampilkan".

---

## 2A. Owner Questions Framework

Setiap section di §2 ada bukan karena "datanya ada, jadi ditampilkan" — tapi karena menjawab pertanyaan spesifik yang benar-benar dipikirkan instruktur. Framework ini jadi filter wajib sebelum nanti masuk fase implementasi UI: **kalau sebuah kartu/grafik tidak bisa dipetakan ke salah satu pertanyaan di bawah, jangan dibuat.**

| Pertanyaan Owner | Dijawab oleh | Section di §2 |
|---|---|---|
| **Apa yang harus saya kerjakan hari ini/minggu ini?** | Pembayaran belum dikonfirmasi, member at-risk, kelas minggu depan kosong, trial mau habis | Action Required (2.0.1) |
| **Apakah bisnis saya tumbuh atau menyusut?** | Revenue growth vs bulan lalu, Member baru vs Member hilang | Business Health (2.0) |
| **Dari mana uang saya berasal, dan apakah cukup?** | Breakdown 4 sumber revenue, metode bayar, pending/outstanding | Keuangan (2.2) |
| **Pertumbuhan member saya datang dari akuisisi atau retensi?** | Member Baru vs Member Lama, repeat attendance | Member (2.3) |
| **Kelas mana yang paling berhasil — dan mana yang butuh perhatian?** | Top kelas by revenue, top kelas by volume kehadiran, occupancy rate | Kelas (2.4) |
| **Apakah komunitas saya berkembang, dan seberapa efektif funnel-nya?** | Total & pertumbuhan kontak, sudah/belum jadi member | Komunitas (2.5) |
| **Apakah event saya menguntungkan, dan strategi harga mana yang bekerja?** | Revenue & peserta per event, mix Early Bird vs OTS | Event (2.6) |
| **Apakah pesan saya benar-benar terkirim, dan kuota saya cukup?** | Delivery rate broadcast, pemakaian kuota broadcast | Marketing (2.7) |
| **Apakah saya akan kena limit paket bulan ini, atau trial mau habis?** | Pemakaian kuota kelas/broadcast, status subscription | Operasional (2.8) |

**Audit balik terhadap §2**: dicek satu per satu, setiap item di §2 punya pertanyaan owner yang jelas di tabel ini — tidak ada kartu yang masuk kategori "datanya ada, tampilkan saja" tanpa alasan. Kalau di fase implementasi nanti muncul ide kartu/metrik baru yang TIDAK bisa dipetakan ke salah satu pertanyaan di atas (atau pertanyaan baru yang belum terdaftar), itu sinyal untuk distop dulu dan ditanya ulang: "pertanyaan apa yang sebenarnya mau dijawab ini?" — bukan langsung dibangun.

---

## 3. KPI Inventory

✅ Tersedia langsung | 🔧 Perlu query baru (data sudah ada, tanpa migrasi) | ❌ Butuh migrasi skema/data baru

### Revenue
| KPI | Status |
|---|---|
| Revenue bulan ini | ✅ |
| Revenue bulan lalu / custom range | 🔧 |
| Growth % MoM | 🔧 |
| Revenue by metode bayar / Payment Profile | 🔧 |
| Pending/outstanding revenue | 🔧 |

### Member
| KPI | Status |
|---|---|
| Total / baru / aktif / at-risk / inactive | ✅ |
| Repeat attendance distribution | 🔧 |
| Lifetime value (LTV) per member | 🔧 (perlu rollup gabungan attendance+membership+registrasi, belum ada view tunggal) |
| Retention / churn rate sungguhan | ❌ (status cuma snapshot, tidak ada riwayat perubahan) |

### Community
| KPI | Status |
|---|---|
| Total kontak | ✅ |
| Pertumbuhan kontak | 🔧 |
| Konversi ke Member | 🔧 (`converted_member_id` sudah ada) |

### Classes
| KPI | Status |
|---|---|
| Top kelas by revenue | ✅ |
| Top kelas by volume kehadiran | 🔧 |
| Occupancy rate | 🔧 |
| No-show rate | ❌ (tidak ada FK attendance↔registrations) |

### Events
| KPI | Status |
|---|---|
| Revenue & jumlah peserta | ✅ |
| Mix Early Bird vs OTS | 🔧 |
| Conversion rate (view → daftar) | ❌ (tidak ada page-view tracking sama sekali) |

### Attendance
| KPI | Status |
|---|---|
| Total kehadiran | ✅ |
| Repeat attendance | 🔧 |
| No-show rate | ❌ (sama seperti di atas — gap skema) |

### Marketing
| KPI | Status |
|---|---|
| Broadcast delivery rate | 🔧 |
| Pemakaian kuota broadcast | 🔧 |
| Volume pesan WA bot | 🔧 (data mentah ada, belum pernah diagregasi) |
| Handover rate bot | ❌ (hasil klasifikasi tidak pernah disimpan) |

### Operations
| KPI | Status |
|---|---|
| Pemakaian kuota kelas aktif | 🔧 (fungsi enforcement sudah ada, belum ditampilkan sebagai info) |
| Status subscription/trial | ✅ |

---

## 4. Quick Wins (langsung bisa, tanpa migrasi/tabel baru)

Mengecek 4 contoh yang diminta, ditambah yang ditemukan dari audit:

| Insight | Bisa sekarang? | Catatan |
|---|---|---|
| **Occupancy rate** | ✅ Ya | Data mentah (`capacity` di classes + count registrasi/attendance per sesi) sudah ada, tinggal query agregasi |
| **Member growth** | ✅ Ya | `members.created_at` langsung bisa di-group per bulan |
| **Repeat attendance** | ✅ Ya | Group `attendance` by `member_id`, count per periode — tidak perlu tabel baru |
| **Conversion komunitas → member** | ✅ Ya | Kolom `converted_member_id` di `community_contacts` sudah persis untuk ini, cuma belum pernah dipakai |

Tambahan quick win lain dari audit data:
- Pending/outstanding revenue (filter `payment_status='pending'`)
- Breakdown revenue by metode bayar
- Pemakaian kuota (kelas/broadcast) ditampilkan ke instruktur — fungsinya sudah ada, cuma untuk enforcement, belum untuk informasi
- Broadcast delivery rate (sent/failed sudah tercatat di `broadcast_recipients`)

Semua ini: **zero migrasi, zero tabel baru** — murni query baru di atas data yang sudah ada.

---

## 5. Expense Tracking via WhatsApp — Evaluasi

**Cocok untuk FitFlow?** Ya. Bot WA sudah jadi kanal utama input data (registrasi, respon broadcast) — memperluas ke pencatatan pengeluaran ("belanja plastik 50k") konsisten dengan DNA produk, bukan fitur asing.

**Kapan dibangun?** **Setelah Laporan V2 (Quick Wins) selesai**, sebagai bagian dari V3 — bukan sekarang. Alasan: ini kemampuan baru yang menambah scope, sementara data Revenue/Attendance yang sudah ada masih punya gap trust LOW yang lebih mendesak diperbaiki dulu (lihat §1). Membangun fitur baru di atas fondasi yang masih longgar cuma menambah utang desain.

**Modul terpisah atau menyatu?** **Tabel & logic terpisah** (`expenses` baru + parsing di route WA bot, bisa reuse pola `classifyHandover` yang sudah terbukti jalan untuk klasifikasi teks bebas via Claude). **Tapi hasilnya menyatu** ke section Keuangan di Laporan, jadi baris baru "Pengeluaran" + kalkulasi "Net Profit" (Revenue − Expense).

**Risiko desain**: kategorisasi otomatis dari teks bebas akan sering salah tebak (plastik = supplies? operasional?). Rekomendasi: bot cuma tangkap nominal + teks asli + tebakan kategori; instruktur koreksi manual lewat dashboard (pola koreksi serupa sudah ada di tempat lain di aplikasi).

**Pengaruh ke Studio nanti**: expense seperti sewa/gaji helper kemungkinan jadi shared cost antar instruktur kalau Studio benar-benar dibangun. Untuk sekarang, scope expense tetap per-`user_id` seperti tabel lain — re-atribusi ke level studio jadi bagian migrasi Studio itu sendiri nanti, bukan beban desain sekarang.

---

## 6. Roadmap Bertahap *(revisi 2026-06-28 — 4 sprint, bukan 3)*

Keputusan: pisahkan "data yang sudah pasti ada" (V2) dari "insight baru yang butuh kerangka berpikir baru" (V2.1), supaya V2 bisa rilis cepat dan langsung dipakai nyata sebelum menambah kompleksitas.

### Sprint 1 — Laporan V2 (langsung setelah UAT, zero migrasi)
- Filter periode (bulan ini/lalu/custom)
- Ringkasan Bisnis (cards)
- Keuangan: breakdown 4 sumber, metode bayar
- Member: jumlah per status
- Kelas: top by revenue & volume, occupancy rate
- Komunitas: total + growth + konversi ke member
- Event: mix tier
- Marketing: delivery rate broadcast
- Operasional: pemakaian kuota

### Sprint 2 — Laporan V2.1 (insight actionable, masih zero migrasi)
- **Business Health Score** (§2.0)
- **Action Required** (§2.0.1)
- **Repeat Customer / Member Baru vs Lama** (§2.3)
- **Pending Revenue** sebagai indikator headline (detail-nya sudah ada di V2 Keuangan, di sini jadi sorotan di Business Health + Action Required)

Alasan dipisah dari Sprint 1: ini bukan data baru, tapi *cara menyajikan* yang baru (status kesehatan + alert) — lebih masuk akal divalidasi setelah struktur dasar V2 dipakai nyata oleh instruktur, supaya tahu indikator mana yang benar-benar penting buat mereka sebelum dikunci sebagai "Health Score".

### Sprint 3 — Laporan V3 (menunggu data/instrumentasi tambahan)
- **Expense Tracking via WhatsApp** (§5)
- **Profit & Loss** (Revenue − Expense, baru mungkin setelah Expense ada)
- No-show rate (butuh FK baru `attendance` ↔ `registrations` — migrasi kecil, TIDAK terkait Studio)
- Member LTV (rollup view gabungan)
- Riwayat status member (tabel baru untuk retention/churn sungguhan)
- WA bot engagement (perlu mulai *menyimpan* hasil klasifikasi handover + agregasi volume pesan)

**Syarat masuk Sprint 3 untuk Expense**: Laporan V2 (+ V2.1) sudah selesai, instruktur sungguhan sudah memakainya, dan sudah ada bukti KPI mana yang paling sering dilihat — baru baru itu Expense Tracking dibuka. Bukan soal idenya kurang baik, tapi soal sequencing: jangan buka domain Akuntansi (Expense/Profit/Cashflow) sebelum domain Revenue sendiri terbukti stabil dipakai.

### Future — Multi Instructor / Studio Analytics
- Perbandingan/ranking performa antar instruktur
- Rollup total lintas studio (revenue, member, kelas)
- Alokasi shared expense (sewa, gaji helper) antar instruktur
- Rollup pertumbuhan komunitas/marketing level studio

**Catatan kompatibilitas**: karena semua query Sprint 1-3 ditulis sebagai fungsi ber-parameter `user_id` (bukan inline per-halaman — lihat prinsip di §1), seluruh isi Sprint 1-3 otomatis jadi building block untuk Future Studio Analytics nanti: tinggal panggil fungsi yang sama untuk tiap instruktur dalam studio dan jumlahkan. Tidak ada satu pun bagian yang perlu ditulis ulang saat Studio benar-benar dibangun.

---

## Rekomendasi Akhir

1. Kerjakan **Sprint 1 (Laporan V2) sampai tuntas** dulu — nilai bisnis tinggi, effort rendah, nol risiko migrasi.
2. **Sprint 2 (V2.1)** baru dikerjakan setelah V2 dipakai nyata — Business Health & Action Required butuh validasi indikator mana yang relevan dari pemakaian sungguhan, bukan ditebak dari atas meja.
3. Tulis setiap query baru sebagai fungsi/RPC ber-parameter `user_id`, bukan inline di halaman — syarat supaya semua sprint tetap valid tanpa redesign saat Studio nanti benar-benar dibangun.
4. **Expense tracking + Profit & Loss masuk Sprint 3**, setelah Revenue/V2/V2.1 terbukti stabil — jangan buka domain Akuntansi sebelum domain Revenue sendiri matang.
5. Sebelum mendalami No-show rate/LTV (Sprint 3), pertimbangkan dulu perbaikan trust-level LOW pada data Attendance — laporan canggih di atas data yang tidak bisa dipercaya cuma menghasilkan angka yang kelihatan yakin tapi salah.
6. **Tidak membahas Studio lebih jauh untuk saat ini** — fokus tunggal: jadikan menu Laporan tempat pertama yang dibuka instruktur untuk tahu kondisi bisnisnya. Expense dan Studio Analytics baru punya konteks jelas setelah itu tercapai.
