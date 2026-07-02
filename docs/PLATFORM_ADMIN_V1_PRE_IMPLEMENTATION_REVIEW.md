# Platform Admin V1 — Pre-Implementation Review

**Tanggal**: 2026-06-30
**Status**: Pressure-test terhadap `docs/PLATFORM_ADMIN_V1_FINAL_DESIGN.md` (desain disetujui di level arsitektur). TIDAK ADA kode/migrasi dibuat. TIDAK ADA keputusan terkunci dibuka ulang (Aktivasi, Funnel, Membership, 3-jalur, Studio Mode, Multi-Instruktur, Landing Page).
**Lingkup**: HANYA 5 area — Health Model, Operational Alerts, Customer List View, Dashboard Sections, Operator Workflow.

---

## Part A — Audit Customer Health Model

Definisi sekarang (dari V1 doc): *Healthy* = aktivitas operasional (attendance/registrasi terkonfirmasi/broadcast terkirim, mana pun lebih baru) ≤14 hari. Diaudit sinyal per sinyal.

| Sinyal | Aktivitas bisnis nyata? | Product usage vs business usage? | Bisa false positive? | Bisa menyembunyikan customer struggling? | Keputusan |
|---|---|---|---|---|---|
| **Attendance** | Ya, paling kuat | Business usage | Risiko sedang — recency-only berarti SATU entri presensi 13 hari lalu "menyegarkan" status sama persis dengan praktik mingguan yang ramai. Tidak membedakan tren menurun dari stabil | Ya, secara halus — instruktur yang attendance-nya turun drastis (20 peserta jadi 2) tapi masih sempat catat satu sesi tiap ~2 minggu akan TERUS terbaca Healthy, tidak pernah masuk Needs Attention | **KEEP**, tapi dokumentasikan eksplisit sebagai limitasi diterima (bukan masalah terselesaikan) — perbaikan butuh data tren/baseline yang sudah sengaja ditunda ke Future di dokumen sebelumnya, jadi tidak ditambal sekarang |
| **Registrasi terkonfirmasi** | Ya, tapi lebih lemah dari attendance (komitmen, bukan layanan terealisasi) | Campuran | Ya — instruktur bisa "mengejar" beberapa registrasi lama dalam satu sesi singkat (buka dashboard, klik confirm beberapa kali), bukan bukti ritme operasional berkelanjutan | Sedang | **MODIFY** — **temuan penting**: sinyal ini HANYA pernah terisi untuk instruktur Jalur A (yang pakai `registrations`). Untuk Jalur B/C, sinyal ini permanen kosong. Ini KESALAHAN YANG SAMA PERSIS dengan bias M3/M4 yang sudah diperbaiki di funnel pra-Aktivasi (Path-A-only), tapi diam-diam muncul lagi di sinyal Health pasca-Aktivasi. Rekomendasi: jangan pernah jadi sinyal TUNGGAL yang menghidupkan status seorang instruktur — selalu OR dengan attendance, dan didokumentasikan eksplisit sebagai sinyal Jalur-A-saja |
| **Broadcast terkirim** | **Tidak** — broadcast adalah aksi komunikasi/marketing, bukan bukti kelas/sesi/member berjalan | **Murni product usage**, bukan business usage | **Ya, jelas dan parah** — mengirim broadcast murah (1 pesan, beberapa detik), tidak butuh kelas/sesi/member apa pun terjadi. Bahkan bisa BERKORELASI TERBALIK dengan kesehatan bisnis (contoh: broadcast "kelas minggu ini diliburkan" justru mengonfirmasi NOL aktivitas bisnis sedang terjadi) | **Ya, langsung** — instruktur yang sedang menutup bisnisnya tapi sempat kirim broadcast "pamit"/promosi terakhir akan terbaca Healthy justru di saat paling berisiko | **REMOVE dari Health Tier.** Broadcast tetap jadi sinyal Product Adoption (sudah benar diposisikan di section terpisah) — TIDAK BOLEH ikut menghitung recency Healthy/Needs Attention. Ini cacat konkret di desain V1 yang harus diperbaiki sebelum implementasi |
| **Community activity** | Tidak (sama alasannya dengan broadcast) | Product usage | Sama risikonya dengan broadcast kalau dimasukkan | Sama | **Sudah benar TIDAK termasuk** di desain V1 — dikonfirmasi di sini supaya eksplisit, bukan kebetulan terlewat. Pertahankan posisi ini |
| **Membership activity (penjualan)** | Sudah diputuskan terkunci: bukan sinyal Aktivasi maupun sinyal Health berkelanjutan, murni Product Adoption + state transisi "Menunggu Kehadiran" | Campuran, dengan risiko false-positive yang SUDAH dibuktikan di review Aktivasi (Case A/B) | Sudah dibuktikan ya, di review sebelumnya | Sudah dibuktikan ya | **Sudah benar TIDAK termasuk** di Health Tier — memasukkannya kembali akan mereproduksi persis false-positive yang sudah ditolak di keputusan Aktivasi. Pertahankan |
| **Status koneksi WA** | Bukan aktivitas, tapi status infrastruktur | — | Rendah, karena dipakai sebagai sinyal NEGATIF (terputus = degradasi), bukan sinyal POSITIF (terhubung ≠ otomatis sehat) | Tidak — penggunaannya sudah benar sebagai trigger penurunan status, bukan bukti kesehatan | **KEEP** — pola pemakaiannya sudah tepat, beda kategori dari broadcast (broadcast dipakai keliru sebagai BUKTI POSITIF kesehatan, WA dipakai benar sebagai PENANDA NEGATIF degradasi) |
| **`classes.is_active` = 0** (komponen At Risk) | Ya — kalau benar-benar nol kelas aktif, mustahil ada operasional nyata, sinyal struktural yang tidak bisa "dipalsukan" semudah broadcast | Business usage (atau ketiadaannya) | Rendah | Tidak | **KEEP**, sudah tepat |

**Kesimpulan Part A**: satu cacat nyata (broadcast) wajib dihapus dari Health Tier sebelum implementasi. Satu inkonsistensi tersembunyi (registrasi terkonfirmasi mewarisi bias Jalur-A) perlu didokumentasikan eksplisit supaya tidak jadi bug diam-diam. Community dan Membership sudah benar dikecualikan sejak awal — dikonfirmasi di sini, bukan diubah.

---

## Part B — Audit Operational Alerts

| Alert | Aksi nyata operator? | Risiko berisik? | Annoying di 100 customer? | Keputusan |
|---|---|---|---|---|
| Trial habis ≤3 hari, BELUM Activated | Ya, jelas | Rendah — dibatasi alami oleh ukuran cohort trial | Rendah | **KEEP** |
| Trial habis ≤3 hari, SUDAH Activated | Ya, tapi urgensi beda | Rendah | Sedang — kalau ditaruh di prioritas SAMA dengan baris di atas, dua jenis "trial habis" akan tercampur padahal makna bisnisnya beda total | **KEEP, tapi turunkan prioritas visual** — jangan disandingkan setara dengan baris pertama di inbox yang sama |
| Membership terjual, belum hadir &gt;14 hari | Ya | **Sedang→Tinggi kalau tidak di-rollup** — satu instruktur populer yang jual banyak paket bisa menghasilkan puluhan baris alert terpisah, satu per member-paket | Tinggi kalau tidak diperbaiki | **KEEP, WAJIB di-rollup per instruktur** ("Instruktur X: 3 membership menunggu kehadiran"), bukan satu baris per member |
| Macet di Go-Live (Jalur A saja) | Ya, sudah di-scope benar dari review sebelumnya | Rendah-Sedang, tergantung akurasi heuristik "masih rutin update" | Sedang | **KEEP**, tapi tandai risiko implementasi di Part F (akurasi heuristik belum terbukti di kode nyata) |
| Registrasi lewat tanggal sesi, presensi kosong | Ya, gap workflow nyata | Sedang — kalau item yang sama terus muncul tiap hari tanpa mekanisme "sudah dilihat/snooze", lama-lama jadi nagging meski tiap kemunculannya valid | Sedang→Tinggi tanpa dedup | **KEEP, WAJIB ada mekanisme dedup/snooze** — tandai sudah-dilihat, jangan tampilkan ulang item yang sama tiap hari tanpa perubahan |
| WA terputus (snapshot saja, V1 belum ada histori) | Niat baik, tapi **secara teknis tidak bisa membedakan "belum pernah connect" dari "baru putus"** tanpa migrasi histori (sudah diakui di V1 doc sendiri) | **Tinggi** — akan tumpang tindih/membingungkan dengan antrian "Permintaan Tautan Bot WA" yang sudah ada, karena keduanya baca kolom snapshot yang sama | Tinggi | **TOLAK untuk V1** — tunda ke Phase 2 setelah migrasi histori koneksi ada. Untuk V1, cukup andalkan antrian link yang sudah ada + breakdown status WA di dashboard (pasif, bukan alert) |

### Evaluasi Khusus: "Pending Registration &gt; 24 jam"

Berdasarkan insiden UAT-001 nyata (instruktur tidak pernah menerima notifikasi WA untuk registrasi Sherly & Elis, baru tahu lewat review manual dashboard) — ini SATU-SATUNYA kandidat alert di seluruh rangkaian dokumen ini yang punya **bukti insiden nyata terkonfirmasi**, bukan risiko spekulatif.

- **Bukan duplikat dari perbaikan instruktur-facing yang sudah didesain** (badge 3-kolom di level instruktur dari closure UAT-001) — alert ini beroperasi di ALTITUDE BERBEDA: perbaikan instruktur-facing menolong instruktur melihat status notifikasi MEREKA SENDIRI; alert platform ini adalah JARING PENGAMAN operator FitFlow untuk menangkap instruktur yang (karena alasan apa pun — notifikasi gagal, sedang sibuk, lupa) tidak sempat menindaklanjuti registrasi yang masuk. Keduanya tetap bernilai independen — bahkan setelah perbaikan instruktur-facing dibangun, instruktur tetap bisa melewatkan dashboard-nya sendiri karena sebab lain.
- Mekanisme murah: `registrations.payment_status='pending'` lebih dari 24 jam — query titik-waktu sederhana, TIDAK butuh baseline/tren (beda dari "lonjakan registrasi"/"penurunan revenue" yang sudah ditolak di review sebelumnya karena butuh histori yang belum ada).
- Secara alami sudah menyaring ke kasus yang relevan: dari catatan UAT Registrations sebelumnya, pembayaran tunai cenderung auto-confirm — registrasi yang nyangkut pending &gt;24 jam kemungkinan besar memang kasus transfer-menunggu-verifikasi-bukti, persis target yang dimaksud.

**Keputusan: TAMBAH**, dengan satu syarat wajib sama seperti alert Membership di atas — **rollup per instruktur** ("Instruktur X: 2 registrasi pending &gt;24 jam"), bukan satu baris per registrasi, supaya instruktur dengan volume tinggi tidak membanjiri inbox.

---

## Part C — Audit Customer List View

Lensa: operator punya 10 detik per baris, harus memprediksi risiko churn, kegagalan onboarding, dan kebutuhan dukungan.

| Kolom yang diusulkan | Tetap? | Alasan |
|---|---|---|
| Business Name | **Keep** | Identitas, tidak bisa dihapus |
| Status (Stage/Health) | **Keep, paling penting** | Satu-satunya kolom yang langsung menjawab ketiga pertanyaan prediktif sekaligus |
| Subscription | **Keep** | Langsung memprediksi urgensi/risiko revenue |
| Member Count | **Turunkan prioritas, posisi & ukuran lebih kecil** | Angka mentah TIDAK prediktif sendirian (5 member sehat ≠ 50 member sehat) — nilainya muncul HANYA sebagai konteks pembanding terhadap kolom Status, bukan sinyal independen |
| WA Status | **Keep** | Langsung relevan untuk kebutuhan dukungan, terhubung ke alert Part B |
| Last Activity | **Keep, dekatkan posisinya ke kolom Status** | Memberi presisi tambahan (3 hari vs 14 hari) di dalam bucket Status yang sama — berguna untuk triase halus antar baris "Healthy", tapi harus ditaruh BERSEBELAHAN dengan Status supaya dibaca sebagai satu pasangan, bukan tersebar |
| Created Date | **Hapus dari kolom default, pindah ke opsi sort** | Untuk instruktur yang sudah Activated, tanggal daftar nyaris tidak prediktif (fakta historis, bukan sinyal kini). Hanya relevan untuk instruktur PRA-Aktivasi (di situ pun sudah terwakili lewat Status="Setup"/"Go-Live" yang sudah menyiratkan durasi). Membebaskan ruang scan untuk kolom yang lebih bernilai |

**Kolom baru yang direkomendasikan**: **Pending Items** (badge kecil, mis. "⚠ 2") — gabungan registrasi pending &gt;24 jam + membership menunggu kehadiran (Part B). Ini langsung menjawab "kebutuhan dukungan" tanpa operator harus buka tiap profil — nilai prediktifnya lebih tinggi dibanding Member Count atau Created Date yang digantikannya.

**Susunan akhir direkomendasikan**: Business Name → Status → Last Activity → Pending Items (baru) → Subscription → WA Status → Member Count (kecil/sekunder). Created Date pindah ke opsi sort, bukan kolom.

---

## Part D — Audit Dashboard Sections

| Section | Tumpang tindih dengan? | Keputusan |
|---|---|---|
| Business Overview | **Ya, dengan Subscription Monitoring** — hitungan trial/aktif/habis muncul di kedua tempat dengan framing sedikit beda | **MODIFY (merge sebagian)** — pindahkan SEMUA angka status-langganan (trial/aktif/habis) sepenuhnya ke Subscription Monitoring sebagai satu sumber kebenaran. Business Overview cukup simpan metrik non-langganan (total instruktur, instruktur baru 7 hari, growth rate). Tanpa ini, dua section bisa diam-diam menampilkan angka yang sedikit berbeda kalau salah satu diupdate logic-nya belakangan tanpa yang lain ikut — risiko maintenance jangka panjang |
| Needs Attention | Beririsan konsep dengan Funnel (bulge di "Macet Go-Live") dan Health (drill-down dari "At Risk: 12") | **KEEP** — tapi ini bukan duplikasi, ini hubungan agregat↔individual yang saling melengkapi (lihat baris Funnel/Health di bawah). Rekomendasikan cross-link (klik bucket di Funnel/Health → filter Customer List), bukan penggabungan section |
| Funnel | Lihat di atas | **KEEP** — representasi agregat "kesehatan sistem onboarding secara keseluruhan", beda fungsi dari daftar aksi individual di Needs Attention |
| Health | Lihat di atas | **KEEP** — sama alasannya dengan Funnel, representasi distribusi vs daftar aksi |
| Subscription | Menyerap dari Business Overview | **KEEP, jadi sumber kebenaran tunggal** untuk semua angka status-langganan |
| WhatsApp Connectivity | Beririsan dengan antrian "Permintaan Tautan Bot WA" di Needs Attention | **KEEP** — breakdown agregat (berapa % connected/pending/disconnected lintas semua instruktur, berguna untuk memantau kesehatan integrasi Fonnte secara keseluruhan) beda fungsi dari antrian aksi spesifik. Sama pola agregat↔individual seperti Funnel/Health |
| Product Adoption | Tidak ada tumpang tindih | **KEEP** — section paling berdiri sendiri, tapi lihat Part E soal frekuensi cek yang berbeda |

---

## Part E — Simulasi Alur Kerja Operator

### 10 customer
- Layar pertama: kemungkinan langsung `/admin/instructors` — di skala ini operator sudah hafal semua nama secara personal, scan visual manual lebih cepat dari membaca dashboard agregat mana pun.
- Yang dicek: Needs Attention (kecil, 0-2 item, cepat selesai).
- Yang diabaikan: **Funnel chart, Health distribution, Product Adoption** — distribusi statistik dari 10 titik data nyaris tidak bermakna, dan operator sudah tahu kondisi tiap orang tanpa agregasi.
- **Temuan kelemahan**: membangun section agregat penuh (Funnel, Health, Product Adoption) di Phase 1 memberi nilai mendekati nol di skala ini — bukan salah dibangun, tapi sequencing-nya perlu disadari: nilai section-section ini baru muncul nyata begitu populasi cukup besar untuk tidak bisa dihafal manual.

### 50 customer
- Layar pertama: tetap Needs Attention, tapi sekarang Health Tier distribution dan sort-by-Status di Customer List mulai benar-benar dipakai (operator tidak lagi bisa menyimpan 50 kondisi di kepala).
- Yang diabaikan: Product Adoption tetap bukan item cek harian — ini section dengan ritme tinjau mingguan/bulanan, bukan harian, layak diberi penekanan visual lebih rendah dibanding section operasional harian (Needs Attention, Health, Subscription).
- Yang mulai krusial: default sort Customer List (Last Activity, paling stale duluan) — di skala ini scrolling tanpa urutan yang tepat mulai memakan waktu nyata.

### 100 customer
- Layar pertama: Needs Attention — dan **di titik inilah seluruh perbaikan noise-reduction di Part B jadi penentu** (rollup per instruktur, dedup/snooze, prioritas trial-Activated diturunkan). Alert berisik di skala 10 cuma sedikit mengganggu; di skala 100 itu beda antara inbox dipakai atau ditinggalkan (alert fatigue, risiko terbesar yang sudah diidentifikasi di review sebelumnya, terbukti ulang lewat simulasi ini dari sudut berbeda).
- Yang diabaikan: scan manual tabel penuh dari atas ke bawah — di skala ini operator nyaris pasti murni mengandalkan FILTER (Status=At Risk, Status=Needs Attention), bukan membaca tabel mentah. Ini menggeser bobot kepentingan: di 100 customer, **kualitas filter lebih penting daripada susunan 7 kolom** yang dibahas Part C.
- Yang jadi overwhelming: pagination/virtualization yang sudah ditandai di V1 doc — simulasi ini MENGONFIRMASI ULANG temuan itu dari sudut alur kerja, bukan temuan baru, tapi penguat independen.
- **Temuan baru khusus skala ini**: bahkan dengan rollup per instruktur, kalau persentase instruktur yang punya item pending cukup tinggi, Needs Attention sendiri bisa membengkak jadi 20-30+ baris — di titik itu inbox-nya sendiri butuh urutan prioritas internal (trial-mendesak di atas, gap-workflow-biasa di bawah), bukan sekadar daftar kronologis "semua yang belum selesai".

---

## Part F — Klasifikasi Risiko Implementasi

| Risiko | Level |
|---|---|
| Broadcast sebagai sinyal Health → false positive pada instruktur yang sebenarnya struggling/tutup | **Tinggi** |
| Alert tanpa rollup per instruktur (Membership Awaiting, Pending Registration) → alert fatigue di skala 100 | **Tinggi** (kalau tidak diperbaiki sebelum 100 customer tercapai) |
| Query Health/Stage dihitung per-baris (N+1 RPC call per instruktur) alih-alih satu query agregat — bukan instruksi "do not code", ini catatan risiko arsitektur untuk implementer | **Sedang**, berpotensi **Tinggi** kalau diimplementasi naif di skala 100 |
| Needs Attention tanpa sub-prioritas internal saat membengkak | **Sedang→Tinggi** di skala 100 |
| Sinyal "registrasi terkonfirmasi" mewarisi bias Jalur-A diam-diam di Health Tier | **Sedang** — bukan bahaya akut, tapi risiko korektnes/maintainability jangka panjang kalau tidak didokumentasikan |
| Attendance recency-only buta terhadap tren menurun | **Sedang** — limitasi diterima & diketahui, bukan bug aktif, perbaikan sudah sengaja ditunda ke Future |
| WA-disconnected alert tumpang tindih dengan antrian link existing | **Sedang** — buang-buang effort implementasi untuk fitur yang tidak menambah sinyal nyata di V1 |
| Business Overview vs Subscription Monitoring duplikasi angka | **Rendah** — risiko maintenance-drift jangka panjang (dua tempat bisa makin berbeda kalau diupdate terpisah), bukan bahaya langsung ke operator |
| Section agregat (Funnel/Health/Product Adoption) bernilai rendah di N=10 | **Rendah** — tidak berbahaya, cuma sequencing/ekspektasi yang perlu disadari, self-resolving seiring volume tumbuh |
| Susunan kolom Customer List belum optimal (Member Count/Created Date terlalu menonjol) | **Rendah** — murni polish UX, tidak menyesatkan |
| Dokumentasi koreksi-koreksi review ini tidak ter-merge balik ke V1 doc sebelum implementasi mulai | **Rendah kemungkinan, Tinggi konsekuensi kalau terjadi** — risiko proses, bukan risiko desain |

---

## Part G — Verdict Final

### **2. Approved with adjustments**

Bukan "approved without changes" — ditemukan cacat konkret (broadcast sebagai sinyal Health) yang akan menyesatkan metrik paling dipercaya operator kalau dibiarkan. Bukan "Not ready" juga — semua temuan adalah koreksi bedah yang sempit, bukan masalah struktural; arsitektur dasarnya tetap sehat.

### Perubahan yang WAJIB sebelum implementasi mulai

1. **Hapus broadcast dari perhitungan recency Health Tier.** Broadcast tetap di Product Adoption saja, tidak pernah ikut menentukan Healthy/Needs Attention.
2. **Rollup per instruktur** untuk alert "Membership terjual, menunggu kehadiran" dan "Pending Registration &gt;24 jam" — satu baris ringkas per instruktur, bukan satu baris per item.
3. **Tambahkan alert "Pending Registration &gt; 24 jam"** — satu-satunya kandidat alert dengan bukti insiden nyata terkonfirmasi (UAT-001), bukan opsional.
4. **Tunda alert "WA terputus" ke Phase 2** (setelah migrasi histori koneksi ada) — di V1, jangan dibangun karena secara teknis tidak bisa membedakan "belum pernah connect" dari "baru putus", berpotensi tumpang tindih membingungkan dengan antrian link yang sudah ada.
5. **Gabungkan angka status-langganan (trial/aktif/habis) HANYA di Subscription Monitoring** — hapus duplikasinya dari Business Overview, supaya tidak ada dua sumber kebenaran yang bisa diam-diam berbeda di masa depan.

### Direkomendasikan, TIDAK menghalangi mulai implementasi

- Susun ulang kolom Customer List (turunkan Member Count/Created Date, naikkan kolom Pending Items baru)
- Cross-link widget agregat (Funnel/Health/WA Connectivity) ke Customer List terfilter
- Turunkan prioritas visual alert "Trial habis, sudah Activated" di bawah "Trial habis, belum Activated"
- Dokumentasikan eksplisit (komentar/catatan implementasi) bahwa attendance recency-only sengaja tidak menangkap tren menurun — supaya tidak disangka sudah selesai
- Saat implementasi, pastikan perhitungan Health/Stage jadi satu query agregat per halaman list, bukan N+1 per baris

---

## Ringkasan Eksekutif

- **Cacat paling penting ditemukan**: broadcast (dan secara implisit, pola yang sama bisa terulang untuk fitur "murah-effort" lain) tidak boleh dipakai sebagai bukti kesehatan bisnis — ini murni product usage, bisa bahkan berkorelasi dengan bisnis yang sedang menutup. Wajib dihapus dari Health Tier sebelum implementasi.
- **Satu-satunya alert dengan bukti insiden nyata** (Pending Registration &gt;24 jam, dari UAT-001) sebelumnya tidak ada di daftar — sekarang ditambahkan sebagai wajib, dengan syarat rollup per instruktur supaya tidak jadi sumber alert fatigue sendiri.
- **Risiko alert fatigue di skala 100** terbukti ulang dari DUA sudut independen (audit Part B dan simulasi Part E) — keduanya sampai ke kesimpulan yang sama tanpa saling bergantung, memperkuat bahwa ini bukan kekhawatiran berlebihan.
- **Section dashboard tidak perlu dirombak**, hanya satu duplikasi nyata (status-langganan di dua tempat) yang perlu disatukan.
- Verdict: **Approved with adjustments** — 5 perubahan wajib di atas, sisanya polish yang bisa menyusul.
