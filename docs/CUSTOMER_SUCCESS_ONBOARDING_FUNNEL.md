# Customer Success & Onboarding Funnel Audit

**Tanggal**: 2026-06-30
**Status**: Audit & desain arsitektur — TIDAK ADA kode/migrasi/UI yang dibuat dari dokumen ini.
**Hubungan dengan dokumen sebelumnya**: ini EKSTENSI dari `docs/PLATFORM_ADMIN_PANEL_ARCHITECTURE.md`, bukan redesign. Funnel ini mengisi satu section yang sengaja belum didetail di dokumen sebelumnya: "kenapa" seorang instruktur berstatus At Risk/Inactive, bukan cuma "bahwa" dia begitu. Customer Health Tier (dokumen sebelumnya) mengukur instruktur yang SUDAH aktif. Funnel ini mengukur instruktur yang BELUM sampai ke titik itu — dua sistem yang saling melengkapi, lihat §6.

---

## 0. Prinsip Desain

Pertanyaan operator yang harus dijawab: **"di mana instruktur ini tersangkut?"** — bukan "berapa skor onboarding-nya". Karena itu funnel ini didesain sebagai checklist bertahap dengan timestamp per tahap, bukan satu angka komposit. Setiap tahap punya 1:1 mapping ke contoh yang diberikan di scope kerja:

| Contoh dari scope | Tahap funnel yang menjawabnya |
|---|---|
| Registered but never created class | M0 selesai, M2 belum |
| Created class but never published landing page | M2 selesai, M3 belum |
| Published landing page but no registrations | M3 selesai, M4 belum |
| Has registrations but no attendance | M4 selesai, M5 belum |
| Uses classes but never uses community | M2/M3 selesai, M6 belum |
| Uses community but never broadcasts | M6 selesai, M7 belum |
| Trial ending before reaching first success milestone | `trial_expires_at` mendekati, M5 belum |

---

## 1. Success Milestones

Diurutkan sesuai urutan alami pemakaian app (bukan urutan kepentingan bisnis) — instruktur class-based dan event-based mengikuti jalur paralel di M2-M5, digabung jadi satu primitive "Core Activity" persis seperti pola yang sudah dipakai codebase ini untuk `business_activity_status` (migrasi 068-069: Kelas + Event digabung lewat `GREATEST()`, didesain supaya kanal baru tinggal ditambah ke primitive tanpa ubah kode pelaporan). Funnel instruktur ini mengikuti filosofi yang sama.

| # | Milestone | Definisi Teknis | Sumber Data | Status |
|---|---|---|---|---|
| **M0** | Akun dikonfirmasi | `instructor_requests.status='confirmed'` → `profiles` dibuat | `confirm-request` API (sudah ada) | ✅ otomatis, trigger mulai trial |
| **M1** | Identitas bisnis lengkap | `profiles.business_name` DAN `profiles.slug` terisi (klaim URL publik) | `profiles` | ✅ |
| **M2** | Konten pertama dibuat | ≥1 row di `classes` ATAU `events` milik `user_id` | `classes`, `events` | ✅ |
| **M3** | Dipublikasikan ke publik | ≥1 `classes.show_registrations=true` (kelas aktif) ATAU ≥1 `events.status='published'` | `classes`, `events` | ✅ |
| **M4** | Registrasi pertama diterima | ≥1 row `registrations` (via `class_id` atau `event_id`) milik instruktur | `registrations` | ✅ |
| **M5** | **Aktivasi** — kehadiran/transaksi pertama nyata terjadi | ≥1 `attendance` row, ATAU ≥1 `registrations.attended=true` (event) | `attendance`, `registrations` | ✅ — lihat §1.1 |
| **M6** | Pakai Community | ≥1 row `community_contacts` | `community_contacts` | ✅ |
| **M7** | Pakai Broadcast | ≥1 row `broadcasts` dengan `sent_at IS NOT NULL` | `broadcasts` | ✅ |

### 1.1 Kenapa M5 = "Aktivasi", bukan M4

M4 (registrasi masuk) sering disalahartikan sebagai sinyal sukses, padahal registrasi tanpa kehadiran/pembayaran terealisasi bukan bukti instruktur sudah merasakan nilai produk — bisa jadi cuma 1 testing registration dari instruktur sendiri, atau orang daftar lalu tidak pernah datang. **M5 adalah momen "aha" yang sebenarnya**: instruktur melihat bukti konkret bahwa kelas/event-nya berjalan dan orang benar-benar hadir/bayar lewat FitFlow. Ini metrik aktivasi yang direkomendasikan untuk semua perhitungan trial-conversion ke depan (lihat §3).

### 1.2 Milestone yang SENGAJA tidak dibuat blocking: M6 dan M7

Community dan Broadcast adalah sinyal **kedalaman adopsi**, bukan jalur wajib menuju sukses. Instruktur kecil yang hanya mengelola 1 kelas mingguan bisa jadi pengguna sehat tanpa pernah pakai keduanya. Karena itu M6/M7 ditampilkan di checklist (§5) tapi TIDAK dipakai untuk menentukan status "stuck" di funnel utama — hanya dipakai sebagai sinyal upsell/edukasi terpisah.

### 1.3 Keterbatasan data yang harus dicatat jujur

Tidak ada satu pun tabel yang mencatat **kapan** sebuah milestone tercapai untuk M3 secara presisi — `classes.updated_at` berubah tiap kali baris kelas diedit apa pun (bukan hanya saat `show_registrations` di-toggle), dan `events` tidak punya `published_at`. Jadi funnel ini bisa menjawab **status saat ini** (sudah/belum) untuk semua milestone, tapi **"butuh berapa lama sampai publish"** (time-to-M3) hanya bisa diperkirakan kasar dari `MIN(created_at)` kelas/event yang published, bukan timestamp transisi sungguhan. Ini paralel dengan gap "tidak ada histori koneksi WA" yang sudah dicatat di dokumen Platform Admin — pola yang sama: snapshot status tersedia, histori perubahan tidak.

---

## 2. Onboarding Stages

Mengelompokkan milestone M0-M5 jadi 4 stage bernama, dipakai sebagai label tunggal di UI (badge per instruktur) — paralel dengan pola penamaan tier yang sudah dipakai di Platform Admin (`Healthy`/`At Risk`/`Inactive`) supaya operator pakai satu kosakata konsisten di seluruh panel.

| Stage | Mencakup | Makna operasional |
|---|---|---|
| **1. Signup** | M0 selesai, M1 belum | Akun ada, instruktur belum sentuh apa-apa. Kalau lama di sini → kemungkinan tidak pernah login pertama kali |
| **2. Setup** | M1-M2 dalam proses | Sedang mengisi identitas/bikin kelas pertama. Tahap paling rawan friction form/UX |
| **3. Go-Live** | M2 selesai, M3 sedang diusahakan | Sudah punya konten, belum publik. Ini titik dengan dua kemungkinan: stuck (tidak tahu cara publish) ATAU sengaja privat (pakai FitFlow cuma untuk kelola internal) — lihat §4 |
| **4. First Traction** | M3 selesai, menuju M5 | Sudah live, menunggu/mengejar registrasi dan kehadiran pertama. Tahap paling kritis untuk trial-conversion |
| **5. Activated** | M5 tercapai | **Lulus dari funnel onboarding** — instruktur ini sekarang dievaluasi lewat Customer Health Tier (dokumen Platform Admin), bukan funnel ini lagi |

Catatan: M6/M7 sengaja tidak punya stage sendiri (lihat §1.2) — ditampilkan sebagai badge tambahan opsional di profil instruktur yang sudah Activated, bukan tahap funnel.

---

## 3. Activation Metrics

Angka-angka yang direkomendasikan untuk dilacak di level platform (agregat lintas instruktur, bukan per-instruktur):

1. **Activation Rate** = (jumlah instruktur yang pernah mencapai M5) / (jumlah instruktur confirmed dalam cohort yang sama). Ini metrik utama — satu angka yang menjawab "apakah onboarding kita bekerja".
2. **Time-to-Activation** = median hari dari `instructor_requests.confirmed_at` ke pertama kali M5 tercapai (`MIN` dari `attendance.created_at` / `registrations.attended` timestamp terkait). Dibandingkan terhadap panjang trial (30 hari, dari `confirm-request/route.ts`) untuk tahu berapa persen waktu trial terpakai habis sebelum instruktur merasakan nilai produk.
3. **Stage Distribution** = jumlah instruktur trial+active saat ini di tiap stage (1-5). Funnel chart horizontal — langsung menunjukkan di stage mana populasi paling menumpuk (bottleneck terbesar).
4. **Trial-Expiry-Before-Activation Rate** = dari instruktur yang trial-nya sudah habis, berapa persen TIDAK PERNAH mencapai M5 sebelum habis. Ini angka yang paling menyakitkan kalau tinggi — berarti produk kehilangan calon pelanggan sebelum mereka sempat melihat nilainya sama sekali, bukan karena mereka mencoba dan tidak suka.
5. **M6/M7 Adoption Depth** (sekunder, bukan funnel utama) = dari instruktur yang sudah Activated, berapa persen yang juga pakai Community / Broadcast — sinyal kesempatan upsell/edukasi, dilaporkan terpisah dari Activation Rate supaya tidak mengaburkan angka utama.

---

## 4. Drop-off Points

Tiap celah antar-milestone dipetakan ke kemungkinan penyebab dan rekomendasi aksi customer success — bukan cuma "instruktur ini stuck di X", tapi kenapa dan apa yang bisa dilakukan operator.

| Celah | Kemungkinan penyebab | Implikasi aksi |
|---|---|---|
| **M0 → M1** (akun ada, identitas belum) | Tidak pernah login pertama kali setelah dapat kredensial WA, atau bingung di mana mengisi slug | Follow-up WA personal — ini bukan masalah produk, ini "belum mulai" |
| **M1 → M2** (identitas ada, belum ada kelas/event) | Form pembuatan kelas/event terlalu rumit, atau tidak tahu harus mulai dari mana | Kandidat untuk onboarding checklist in-app / tutorial, bukan cuma follow-up manual |
| **M2 → M3** (punya konten, belum publish) | **Dua kemungkinan berbeda, jangan disamakan**: (a) tidak tahu toggle "Tampilkan di landing page" ada — gap edukasi; (b) SENGAJA tidak publish karena memang hanya pakai FitFlow untuk kelola internal (jadwal, presensi) tanpa booking publik — ini pemakaian valid, bukan kegagalan. Funnel butuh cara membedakan keduanya sebelum dianggap "stuck" (mis. instruktur yang sudah lama di stage ini TAPI rutin update kelas/sesi = pemakaian internal yang sehat, bukan macet) | Jangan auto-alert instruktur kategori (b) sebagai "berisiko" — akan terasa salah sasaran |
| **M3 → M4** (publish, belum ada registrasi) | Instruktur belum sebar link landing page-nya ke calon klien — ini masalah marketing instruktur, sebagian di luar kendali FitFlow | Aksi yang masuk akal: nudge "bagikan link kamu" di app, bukan alert ke operator (operator tidak bisa menyebar link orang lain) |
| **M4 → M5** (ada registrasi, belum ada kehadiran tercatat) | Bisa karena sesi belum berlangsung (baru daftar, belum waktunya) — bukan stuck, cuma belum waktunya. ATAU instruktur tidak tahu/lupa cara mencatat presensi — ini gap workflow nyata kalau registrasi sudah lewat tanggal sesi tapi presensi tetap kosong | Hanya alert kalau `session_date`/`event_date` registrasi sudah lewat DAN attendance masih kosong — bedakan "belum waktunya" dari "macet di workflow" |
| **Trial mendekati habis, M5 belum tercapai** | Kombinasi celah mana pun di atas yang belum terselesaikan sebelum waktu trial habis | **Prioritas tertinggi** — beda fundamental dari instruktur trial-habis yang SUDAH Activated (kemungkinan besar akan bayar) vs yang belum pernah merasakan nilai sama sekali (hampir pasti churn, dan kemungkinan keluar dengan kesan trial terlalu pendek padahal sebenarnya mereka belum sempat mulai) |

---

## 5. Customer Success Dashboard — Tambahan

Sesuai instruksi: **tidak meredesain** Platform Admin, hanya menambah ke struktur 3-lapis yang sudah dirancang di dokumen sebelumnya.

### Lapis 1 — `/admin` (tambahan baru)
**Onboarding Funnel** (section baru, ditempatkan setelah "Needs Attention" yang sudah didesain sebelumnya):
- Funnel chart horizontal: jumlah instruktur trial+active saat ini di tiap stage 1-5 (§2)
- Activation Rate cohort bulan ini vs bulan lalu (§3.1) — satu angka, trend naik/turun

### Lapis 1 — `/admin` "Needs Attention" inbox (perluasan, bukan section baru)
Tambahkan jenis alert baru ke inbox yang sudah didesain di dokumen Platform Admin (§E dokumen itu):
- **Trial akan habis, belum aktivasi** (`trial_expires_at` ≤3 hari DAN M5 belum tercapai) — prioritas di atas alert "trial akan habis" biasa, karena implikasinya beda (lihat §4)
- **Macet di Go-Live &gt;14 hari** (M2 tercapai, M3 belum, DAN masih ada update rutin ke kelas/sesi — supaya tidak salah tangkap kategori (b) di §4)
- **Registrasi terlewat tanpa presensi** (M4 tercapai, tanggal sesi/event sudah lewat, attendance masih kosong)

### Lapis 2 — `/admin/instructors` (perluasan filter, bukan halaman baru)
Tambahkan ke filter pills yang sudah ada (Semua/Aktif/Trial/Habis/Bot WA belum setup):
- Filter per stage (§2): "Setup", "Go-Live", "First Traction" — supaya operator bisa langsung lihat semua instruktur yang macet di tahap tertentu
- Badge stage di tiap baris list (terpisah dari badge status langganan yang sudah ada)

### Lapis 3 — `/admin/[profileId]` (section baru di detail page)
**Onboarding Checklist** — ditaruh tepat di bawah "Status & Risiko" yang sudah direkomendasikan di dokumen Platform Admin (§C.2 dokumen itu), karena ini jawaban paling literal atas "di mana instruktur ini tersangkut":
- Daftar M0-M7 sebagai checklist dengan status (selesai dengan tanggal perkiraan / belum)
- Untuk milestone yang belum tercapai, satu baris penjelasan dari §4 (kenapa biasanya macet di sini)
- Untuk M2→M3 gap khususnya: tampilkan juga apakah instruktur masih rutin update kelas/sesi (bedakan "stuck" dari "sengaja privat")

---

## 6. Bagaimana Funnel Ini Terhubung dengan Customer Health Tier

Supaya tidak ada celah maupun tumpang tindih antara dua dokumen:

- **Sebelum M5 (Activated)**: instruktur dievaluasi LEWAT FUNNEL INI. Health Tier dari dokumen Platform Admin tidak relevan dulu — instruktur yang belum pernah dapat kehadiran/transaksi nyata tidak bisa dinilai "At Risk" atau "Inactive" dalam pengertian dokumen itu (dia memang belum sempat aktif).
- **Setelah M5**: instruktur "lulus" dari funnel ini dan masuk ke Health Tier (Healthy/At Risk/Inactive/Churned) dari dokumen Platform Admin. Funnel tidak lagi relevan untuknya kecuali sebagai catatan historis ("butuh X hari untuk aktivasi").
- Implikasi UI: badge stage funnel (§2) dan badge Health Tier (dokumen Platform Admin) **tidak pernah tampil bersamaan untuk instruktur yang sama** — satu instruktur hanya punya satu badge aktif tergantung sudah/belum Activated. Mencegah operator melihat dua sistem skor yang membingungkan di satu baris.

---

## Ringkasan Eksekutif

- Funnel terdiri dari 8 milestone (M0-M7), 4 di antaranya (M0-M3) murni soal setup, M4-M5 soal traksi nyata, M6-M7 soal kedalaman adopsi (sengaja tidak blocking).
- **M5 (kehadiran/transaksi pertama nyata) adalah definisi Aktivasi** — metrik utama untuk mengukur efektivitas trial 30 hari, bukan M4 (registrasi masuk) yang sering disalahartikan sebagai sukses.
- Semua data untuk funnel ini **sudah ada di skema, nol migrasi dibutuhkan** — termasuk temuan kunci bahwa `classes.show_registrations` (default false) secara harfiah adalah flag "publish ke landing page" yang dicari di scope kerja.
- Satu gap data jujur: tidak ada histori transisi status (kapan tepatnya sebuah kelas di-publish), hanya snapshot status terkini — sama seperti gap histori koneksi WA di dokumen sebelumnya.
- Satu nuansa penting yang harus dijaga di implementasi: gap M2→M3 (punya kelas, belum publish) punya dua penyebab yang sangat berbeda (stuck vs sengaja privat) — jangan di-alert sebagai "berisiko" tanpa membedakan keduanya, supaya operator tidak salah sasaran follow-up.
- Funnel ini dan Customer Health Tier dari dokumen Platform Admin saling melengkapi lewat satu titik serah-terima yang jelas: M5 (Activated).
