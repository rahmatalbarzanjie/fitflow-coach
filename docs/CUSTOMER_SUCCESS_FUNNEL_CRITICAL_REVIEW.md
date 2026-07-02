# Customer Success Funnel — Critical Review

**Tanggal**: 2026-06-30
**Status**: Pressure-test terhadap `docs/CUSTOMER_SUCCESS_ONBOARDING_FUNNEL.md` (draft proposal). TIDAK ADA kode/migrasi/UI dibuat dari dokumen ini. Dokumen asli BELUM diubah — rekomendasi di sini perlu disetujui dulu sebelum funnel doc direvisi.
**Sikap kerja**: mengasumsikan desain awal SALAH sampai terbukti benar lewat audit data nyata, bukan sekadar membaca ulang argumen yang sudah ada.

---

## Temuan Pembuka yang Mengubah Seluruh Analisis

Sebelum masuk ke Part A-F: ada satu temuan struktural di skema yang TIDAK terlihat di audit sebelumnya, dan ini membatalkan asumsi paling dasar funnel yang ada — bahwa M5 (Aktivasi) datang SETELAH M4 (registrasi).

**Fakta dari skema**: tabel `attendance` (migrasi 001) di-FK murni ke `session_id` + `member_id`. **Tidak ada FK ke `registrations` sama sekali.** Instruktur bisa mencatat kehadiran langsung dari halaman kelola member (`/members/[id]/attendance`) untuk member mana pun, kapan pun, tanpa member tersebut pernah melalui form registrasi publik. Member sendiri bisa ditambahkan langsung lewat `/members/new` — sama sekali tidak butuh registrasi.

Lebih jauh, ada jalur ketiga: `member_memberships` (migrasi 035, paket membership) juga berdiri sendiri — member beli paket, `purchase_price` tercatat, status langsung `active`. Tidak ada hubungan apa pun ke `registrations`.

**Implikasi**: produk FitFlow sebenarnya punya **tiga jalur independen** menuju "bisnis nyata berjalan", bukan satu jalur linear:

| Jalur | Urutan nyata | Butuh M3/M4? |
|---|---|---|
| **A — Public Booking** | Landing page publik → `registrations` → kehadiran/event attended | Ya, ini satu-satunya jalur yang benar-benar butuh M3 (publish) dan M4 (registrasi) |
| **B — Walk-in/Manual** | Instruktur tambah member manual → catat presensi tiap minggu | **Tidak** — sama sekali tidak menyentuh `registrations` |
| **C — Membership** | Instruktur tambah member → jual paket membership → presensi otomatis potong sesi | **Tidak** — sama sekali tidak menyentuh `registrations` |

Funnel yang ada hari ini hanya memodelkan Jalur A sebagai SATU-SATUNYA jalur menuju Aktivasi. Untuk instruktur yang menjalankan bisnisnya lewat Jalur B atau C (sangat mungkin mayoritas, mengingat persona "Personal Instructor" / "Small Fitness Community" yang sudah dikonfirmasi sebagai target pasar) — **mereka tidak akan PERNAH mencapai M5 menurut definisi funnel sekarang**, walau mereka mencatat presensi tiap minggu dan menerima uang nyata dari membership. Ini bukan detail kecil — ini cacat struktural yang akan membuat Activation Rate platform terbaca jauh lebih rendah dari kenyataan, dan akan membuat operator salah menyimpulkan "onboarding kita gagal" padahal sebenarnya pengukurannya yang salah.

Temuan ini mendasari hampir semua rekomendasi di Part A-F di bawah.

---

## Part A — Audit Per Milestone

| # | Bermakna? | Terukur? | Actionable? | Bisa menyesatkan? | Klasifikasi |
|---|---|---|---|---|---|
| **M0** Akun dikonfirmasi | Sebagian — ini aksi ADMIN (operator approve), bukan aksi instruktur | Ya, exact timestamp | Ya, tapi untuk tim FitFlow sendiri (kecepatan approve), bukan untuk instruktur | **Ya** — kalau dihitung sebagai bagian "instruktur journey", instruktur yang lama di M0 terlihat seperti "tidak mulai-mulai", padahal yang lambat adalah antrian approval FitFlow sendiri | **MODIFY** — pisahkan jadi gate/penanda mulai cohort, BUKAN bagian funnel perilaku instruktur. Jangan hitung waktu di M0 sebagai "instruktur stuck" |
| **M1** Identitas bisnis (business_name + slug) | `business_name` HAMPIR SELALU sudah terisi sejak form pendaftaran publik (`instructor_requests.business_name`, migrasi 011) — bukan aksi baru instruktur setelah login. `slug` BARU aksi nyata (diisi sendiri di Pengaturan) | Ya | Hanya untuk komponen `slug` | **Ya** — meng-AND-kan dua kondisi yang beda level (satu hampir selalu true dari form, satu butuh aksi aktif) mengaburkan sinyal asli. Risiko bug konsep: instruktur yang business_name-nya sudah ada dari form tapi belum pernah login sama sekali bisa salah terbaca "separuh jalan" padahal 0% terlibat | **MODIFY** — M1 = `slug` saja. `business_name` dibuang dari funnel (sudah hampir selalu true, nol nilai diagnostik) |
| **M2** Kelas/Event pertama | Ya, aksi jelas dan tak ambigu | Ya | Ya | Risiko kecil: OR antara kelas vs event menyembunyikan model bisnis instruktur (rutin mingguan vs one-off), padahal itu menentukan jalur mana yang relevan berikutnya | **KEEP**, tambah tag metadata (kelas-led / event-led), bukan milestone baru |
| **M3** Published | Sudah diakui ambigu di dokumen asli (stuck vs sengaja privat) — TAPI tetap dipaksa jadi gate linear | Ya | Hanya untuk instruktur yang memang berniat pakai booking publik | **Ya, parah** — lihat Temuan Pembuka. Instruktur Jalur B/C akan permanen "nyangkut" di sini walau sehat | **MODIFY** — turun status dari gate funnel inti jadi bagian Sub-Funnel "Public Booking", hanya berlaku untuk instruktur yang memang masuk Jalur A |
| **M4** Registrasi pertama | Sama seperti M3 — valid HANYA untuk Jalur A | Ya | Hanya relevan Jalur A | **Ya, parah** — sama alasan dengan M3 | **MODIFY** — sub-funnel, bukan gate inti |
| **M5** Kehadiran nyata pertama (Aktivasi) | Ya — sinyal terbaik "bisnis nyata jalan di FitFlow", paling kuat dari semua milestone | Ya | Ya | Hanya menyesatkan kalau tetap dianggap "butuh M4 dulu" (lihat Temuan Pembuka) — sebagai konsep murni, M5 sendiri TIDAK menyesatkan | **KEEP** sebagai definisi Aktivasi, tapi **WAJIB diputus dari prasyarat M4** — lihat Part B |
| **M6** Pakai Community | Sudah benar diposisikan non-blocking di dokumen asli | Ya | Sinyal upsell/edukasi | Risiko rendah, sudah ditangani dengan benar | **KEEP** sebagai Advanced Adoption |
| **M7** Pakai Broadcast | Ya sebagai sinyal adopsi, TAPI ada prasyarat tersembunyi: bot WA harus disetujui ADMIN dulu (`bot_phone_requested` → admin approve → `fonnte_token`) sebelum broadcast bisa terjadi sama sekali | Ya | Hanya actionable kalau prasyarat WA sudah dicentang | **Ya** — sama pola dengan M0: M7=0 bisa berarti "instruktur belum coba" ATAU "antrian approval WA bot FitFlow belum diproses", dua hal yang butuh aksi berbeda total | **MODIFY** — tambahkan flag eksplisit "WA bot connected?" sebagai prasyarat sebelum membaca M7=0 sebagai sinyal adopsi instruktur |

---

## Part B — Review Definisi Aktivasi

**Apakah M5 benar-benar momen pertama pelanggan merasakan nilai?** Untuk Jalur A (registrasi publik), ya — kehadiran nyata adalah bukti konkret. Tapi pertanyaan yang lebih tajam: apakah M5 SEBAGAI DIDEFINISIKAN SEKARANG (terikat ke prasyarat M4) bisa dicapai oleh instruktur Jalur B/C? **Tidak** — itulah cacat utama, sudah dijelaskan di Temuan Pembuka.

**Apakah M4 terlalu dini?** Setuju dengan dokumen asli — registrasi tanpa kehadiran/pembayaran terealisasi bukan bukti nilai dirasakan. Tetap M4 too early untuk jadi Aktivasi.

**Apakah M5 terlalu telat?** Untuk Jalur A dengan event berbayar di muka (deposit/transfer sebelum hari-H), ada argumen bahwa pembayaran terkonfirmasi adalah komitmen lebih kuat daripada kehadiran (analoginya: di SaaS B2C, "first payment" sering dianggap aktivasi lebih valid daripada "first usage"). Tapi argumen ini HANYA berlaku untuk sebagian kecil dari Jalur A (registrasi event dengan pembayaran transfer dimuka) — tidak universal (lihat Part C). Jadi tidak cukup kuat untuk menggantikan M5 sebagai gate utama.

**Apakah ada titik aktivasi yang lebih baik?** Bukan titik yang berbeda — tapi DEFINISI yang lebih lengkap dari titik yang sama. M5 tetap titik paling tepat secara konsep ("bisnis nyata berjalan lewat FitFlow"), masalahnya bukan TITIK-nya tapi JALUR menuju titik itu yang dipersempit secara salah jadi hanya satu (Jalur A).

**Rekomendasi final**: 
- **KEEP M5 sebagai definisi Aktivasi**, dengan dua perbaikan wajib:
  1. **Putuskan dari prasyarat M4** — M5 dicapai lewat SALAH SATU dari 3 jalur (lihat Part F #2), bukan harus lewat M4 dulu.
  2. **Pertimbangkan "Sustained Activation" sebagai metrik tambahan opsional (bukan inti v1)** — 1x kehadiran tercatat bisa jadi instruktur sekadar uji coba fitur, bukan bukti retensi nyata. Sinyal kedua: ≥2 tanggal sesi berbeda dengan kehadiran tercatat dalam window waktu tertentu. Ini disengaja DITUNDA ke fase lanjutan supaya tidak menambah kompleksitas funnel inti sebelum versi sederhananya divalidasi — prinsip yang sama dengan "validasi dulu sebelum dikunci" yang sudah jadi pola kerja proyek ini.

---

## Part C — Review M4.5 (Payment Confirmed)

**Apakah Payment Confirmation bermakna sebagai milestone bisnis?** Ya, tapi HANYA untuk satu kasus spesifik: registrasi publik dengan metode transfer bank, di mana `registrations.payment_status` berubah dari `pending` ke `confirmed` lewat verifikasi manual `proof_url` oleh instruktur. Ini representasi nyata dari friksi operasional (instruktur harus cek bukti transfer).

**Apakah universal di semua alur FitFlow?** **Tidak, sama sekali tidak** — dibuktikan langsung dari skema:
- **Jalur Walk-in**: `attendance.amount_paid` terisi LANGSUNG di momen presensi dicatat (`payment_mode='drop_in'`) — pembayaran dan "konfirmasi" terjadi dalam satu aksi yang sama, tidak ada tahap "pending" yang berdiri sendiri.
- **Jalur Membership**: `member_memberships` TIDAK PUNYA status `pending` sama sekali — `status` langsung `active` saat baris dibuat. Tidak ada state machine pembayaran sama sekali.
- **Bahkan di dalam Jalur A sendiri**: pembayaran tunai/OTS di lokasi event kemungkinan auto-confirm tanpa verifikasi terpisah (ini pertanyaan bisnis yang SUDAH tercatat terbuka di backlog UAT Registrations sebelumnya — honor system untuk cash). Jadi M4.5 hanya benar-benar punya makna untuk subset SANGAT SEMPIT: registrasi publik DENGAN metode transfer DAN belum auto-confirm.

**Apakah memperbaiki diagnosis funnel?** Untuk segmen sempit itu, ya — bisa menangkap "instruktur tidak pernah cek bukti transfer yang masuk", gap workflow yang nyata. Tapi segmen itu adalah irisan dari irisan (Jalur A ∩ metode transfer ∩ belum auto-confirm).

**Apakah menciptakan kompleksitas semu?** Ya, kalau dipasang sebagai milestone bernomor di funnel UTAMA — mayoritas instruktur (Jalur B, Jalur C, atau Jalur A dengan cash) akan selalu menampilkan M4.5 sebagai "tidak berlaku"/"terlewat", yang akan terlihat seperti drop-off padahal bukan. Ini persis kesalahan yang sama dengan M3/M4 sebelum diperbaiki di Part A — memaksakan milestone satu-jalur ke funnel yang mengklaim universal.

### Keputusan: **REJECT M4.5 sebagai milestone funnel inti.**

Alasannya bukan karena sinyalnya tidak berguna — sinyalnya nyata, tapi cakupannya terlalu sempit untuk jadi nomor di funnel utama. Rekomendasi pengganti: simpan sebagai **sub-metrik diagnostik**, bukan milestone — "payment confirmation lag" (selisih `registered_at` ke `confirmed_at`), DIHITUNG HANYA untuk registrasi dengan `payment_method='transfer'`, ditampilkan sebagai metrik operasional di Sub-Funnel Public Booking (lihat Part F), bukan sebagai gate di funnel utama mana pun.

---

## Part D — Review Kelengkapan Funnel

| Kandidat | Sudah terukur? | Keputusan | Alasan |
|---|---|---|---|
| **Landing page viewed** | ❌ Tidak ada tabel analytics/pageview sama sekali di skema | **TIDAK dikejar sekarang** — kalau pun nanti dibangun, masuk kategori "Separate Product Usage Metrics", bukan funnel inti | Butuh instrumentasi baru (migrasi + tracking), dan secara konsep dekat dengan vanity metric (lihat prinsip "hindari vanity metrics" yang sudah dikunci di dokumen Platform Admin) — melihat halaman bukan bukti niat, beda dengan registrasi/kehadiran yang aksi nyata |
| **First WA broadcast** | Sudah ada sebagai M7 | Tidak perlu ditambah — sudah di funnel, hanya butuh perbaikan di Part A (prasyarat WA bot) | — |
| **First membership sold** | ✅ Sudah ada di skema (`member_memberships.purchase_price`), belum pernah dipakai sebagai sinyal funnel | **TAMBAH ke Core Funnel** — sebagai jalur alternatif menuju M5, bukan milestone bernomor baru | Ini justru menutup blind spot terbesar yang ditemukan hari ini (Jalur C). Uang sungguhan berpindah tangan di muka — sinyal komitmen nyata, setara atau lebih kuat dari kehadiran |
| **First refund processed** | ✅ Ada (`member_memberships.refund_amount`/`refunded_at`) | **TIDAK masuk funnel ini** — ini sinyal risiko/churn, bukan sinyal sukses onboarding | Lebih tepat jadi salah satu signal di Customer Health Tier (dokumen Platform Admin), bukan duplikasi kerja di sini. Funnel onboarding mengukur jalan MENUJU sukses, bukan tanda-tanda bahaya setelahnya |

Kandidat tambahan yang muncul dari audit hari ini (di luar contoh yang diberikan):
- **Community contact dikonversi jadi member** (`community_contacts.converted_member_id`) — bukan milestone baru, cukup jadi sub-metrik kedalaman di bawah M6.
- **WA bot connected** (prasyarat M7) — bukan milestone baru, jadi flag prasyarat eksplisit (sudah disebut di Part A).

---

## Part E — Review dari Sudut Pandang SaaS Operator (Skala 50/100/500)

**50 instruktur**: masih bisa ditangani manual — operator scan list, klik satu-satu untuk pastikan instruktur yang "nyangkut" di M3 itu memang stuck atau sengaja Jalur B/C. Bottleneck di tahap mana pun masih cukup kecil volumenya untuk dicek manual, jadi cacat struktural (Temuan Pembuka) belum terasa menyakitkan di skala ini.

**100 instruktur**: titik di mana mengandalkan penilaian manual operator (baca: "instruktur ini masih rutin update kelas, berarti bukan stuck") mulai tidak scalable. Funnel HARUS sudah punya logika otomatis untuk membedakan Jalur A/B/C di titik ini, bukan lagi heuristik yang dibaca manual oleh operator.

**500 instruktur** — risiko operasional paling serius muncul di sini:
1. **Bottleneck stage paling besar akan SELALU "Go-Live"/M3**, bukan karena memang macet di sana, tapi karena populasi instruktur Jalur B/C (yang memang tidak pernah berniat publish) akan menumpuk di bucket itu kalau funnel tidak diperbaiki sesuai Part F. Operator akan salah baca "banyak yang stuck di publish" padahal sebagian besar sehat-sehat saja.
2. **Alert paling berisik**: "Macet di Go-Live >14 hari" (alert yang diusulkan di dokumen Platform Admin) — kalau M3 tetap gate inti, alert ini akan menembak ratusan false-positive dari instruktur Jalur B/C murni di skala 500. Ini risiko operasional TERBESAR dari semua yang ditemukan — operator akan capek lihat alert yang ternyata salah sasaran berulang-ulang, lalu mulai mengabaikan seluruh inbox "Needs Attention" (kegagalan klasik di SaaS ops: alert fatigue).
3. **Metrik paling sulit dipercaya**: **Activation Rate**. Kalau definisi lama (M5 butuh M4) dipakai di skala 500, angkanya akan terbaca jauh lebih rendah dari kenyataan — karena memang secara struktural tidak menghitung Jalur B/C sebagai aktivasi sama sekali. Risikonya bukan cuma "angka salah" — risikonya operator/founder bisa mengambil keputusan investasi produk yang salah arah (mis. "onboarding kita buruk, harus dirombak total") padahal sebenarnya yang rusak adalah cara mengukurnya, bukan produknya.
4. Risiko sekunder skala: metrik "time-to-publish" (sudah diakui di dokumen asli sebagai perkiraan kasar lewat `updated_at`) akan makin sering salah di skala besar karena makin banyak edge case (instruktur edit kelas untuk alasan lain, ikut mereset perkiraan "kapan pertama publish"). Tidak butuh perbaikan sekarang, tapi dicatat sebagai utang teknis yang makin terasa seiring volume naik.
5. Implikasi tidak langsung: makin banyak instruktur = makin banyak kemungkinan butuh admin FitFlow >1 orang menangani inbox — ini menyambungkan kembali ke gap `is_platform_admin`/audit-log yang sudah dicatat "belum genting" di dokumen Platform Admin. Di skala 500, gap itu jadi lebih mendesak, bukan murni teoretis lagi.

---

## Part F — Final Recommendation

### 1. Approved Funnel (struktur baru, bercabang — bukan linear)

```
M0 (Signup Approved — penanda cohort, BUKAN bagian funnel perilaku instruktur)
  ↓
M1 (slug diklaim — business_name dibuang dari gate)
  ↓
M2 (kelas/event pertama dibuat, ditandai tipe: kelas-led / event-led)
  ↓
   ┌─────────────┬──────────────────┬───────────────────┐
   │ Jalur A      │ Jalur B           │ Jalur C            │
   │ Public       │ Walk-in/Manual    │ Membership         │
   │ Booking      │                   │                    │
   │ M3 publish   │ member ditambah   │ member ditambah    │
   │ M4 registrasi│ manual            │ manual              │
   │              │                   │ + paket terjual    │
   └──────┬───────┴─────────┬─────────┴──────────┬─────────┘
          └─────────────────┼────────────────────┘
                             ↓
              M5 = AKTIVASI (kehadiran nyata tercatat
                   ATAU membership pertama terjual)
                             ↓
              M6 (Community) → M7 (Broadcast)
              [Advanced Adoption, non-blocking, urutan bebas]
```

M3/M4 (Jalur A) HANYA ditampilkan/dialertkan untuk instruktur yang memang sudah mulai masuk Jalur A (punya minimal 1 kelas/event yang sedang diusahakan untuk publish) — tidak dipaksakan ke semua instruktur.

### 2. Activation Definition

**Aktivasi = M5, didefinisikan ulang sebagai**: kehadiran nyata pertama tercatat (lewat jalur mana pun) **ATAU** membership pertama terjual. Diputus total dari prasyarat M4. Reachable lewat Jalur A, B, atau C — operator melihat satu Activation Rate yang sekarang benar-benar mewakili seluruh populasi instruktur, bukan cuma yang pakai booking publik.

"Sustained Activation" (≥2 sesi kehadiran berbeda) dicatat sebagai kandidat metrik fase lanjutan — TIDAK masuk v1.

### 3. M4.5 — Keputusan

**REJECTED** sebagai milestone funnel inti. Disimpan sebagai sub-metrik diagnostik ("payment confirmation lag") khusus untuk registrasi Jalur A dengan metode transfer, ditampilkan di level Sub-Funnel Public Booking saja.

### 4. Perubahan Dashboard yang Dibutuhkan (desain saja, masih nol migrasi)

- Badge stage instruktur HARUS membaca jalur mana yang sedang/sudah ditempuh (A/B/C), bukan memaksa semua orang lewat gate M3/M4
- Funnel chart di Lapis 1 (`/admin`, section "Onboarding Funnel" dari dokumen Platform Admin): untuk v1, KOLAPS jadi satu funnel dengan resolusi milestone yang sadar-jalur (M5 dihitung dari OR ketiga jalur) — jangan dulu pecah jadi 3 funnel terpisah (volume instruktur belum cukup besar untuk itu bernilai, lihat Part E skala 50)
- **Activation Rate harus dihitung ulang** dengan definisi M5 baru — ini perubahan dengan dampak metrik paling besar dari seluruh rekomendasi

### 5. Perubahan Platform Admin yang Dibutuhkan (desain saja)

- Alert "Macet di Go-Live >14 hari" (diusulkan di dokumen Platform Admin) **HANYA boleh menyala untuk instruktur yang sudah mulai Jalur A** (punya kelas/event yang sedang diusahakan publish) — JANGAN PERNAH menyala untuk instruktur Jalur B/C murni. Ini perbaikan wajib sebelum alert itu diimplementasikan, supaya risiko alert fatigue di Part E tidak terjadi sejak awal
- Onboarding Checklist di halaman detail instruktur (`/admin/[profileId]`) perlu memisahkan visual "jalur inti menuju Aktivasi" (jalur yang sedang ditempuh instruktur ini) dari "Sub-Funnel Public Booking" (cuma relevan/ditampilkan kalau instruktur memang menyentuh Jalur A)
- Tambahkan flag eksplisit "Bot WA terhubung?" sebagai prasyarat yang dicek SEBELUM M7=0 dibaca sebagai "instruktur belum coba broadcast"

### 6. Perubahan Customer Success Monitoring yang Dibutuhkan

- Activation Rate & Time-to-Activation dihitung ulang dengan definisi M5 baru (OR tiga jalur)
- **Cohort split baru**: laporkan Activation Rate terpisah per kombinasi jalur (murni Jalur A / murni Jalur B+C / campuran) — ini wawasan operator yang valid dan baru, muncul natural dari perbaikan cacat struktural, bukan fitur tambahan yang dipaksakan
- "Landing page viewed" ditunda tanpa batas waktu — tidak masuk roadmap manapun untuk saat ini
- "First refund processed" dialihkan jadi sinyal di Customer Health Tier (dokumen Platform Admin), bukan ditambahkan di funnel ini

---

## Ringkasan Eksekutif

- **Cacat paling kritis di desain awal**: funnel memodelkan HANYA satu dari tiga jalur nyata menuju nilai bisnis (Public Booking), padahal dua jalur lain (Walk-in/Manual, Membership) sama sekali tidak menyentuh `registrations` secara struktural di skema. Ini bukan detail kecil — ini akan membuat Activation Rate platform terbaca jauh lebih rendah dari kenyataan begitu basis instruktur tumbuh.
- M0 dan M7 sama-sama punya gap yang sama: keduanya bisa bernilai 0 karena ALASAN OPERASIONAL FITFLOW SENDIRI (antrian approval signup, antrian approval link WA bot), bukan murni perilaku instruktur — funnel harus eksplisit memisahkan dua jenis penyebab ini.
- **M4.5 (Payment Confirmed) ditolak** sebagai milestone inti — sinyalnya nyata tapi hanya berlaku untuk irisan sempit (registrasi transfer, belum auto-confirm), terlalu sempit untuk jadi gate universal. Disimpan sebagai sub-metrik, bukan dibuang total.
- **M5 tetap definisi Aktivasi yang benar** — masalahnya bukan titiknya, tapi jalur menujunya yang harus dilebarkan dari satu jadi tiga (OR, bukan AND).
- Risiko operasional terbesar di skala besar (500 instruktur): **alert fatigue** dari M3/M4 yang salah menembak instruktur Jalur B/C, dan **hilangnya kepercayaan pada Activation Rate** kalau definisi lama dipertahankan — keduanya dicegah lewat perbaikan struktural di Part F, bukan ditambal lewat threshold yang lebih longgar.
