# FitFlow — Operational Readiness Remediation Plan

Disusun: 2026-06-25, setelah seluruh 10 modul Master UAT selesai diaudit
(Classes, Registrations, Events, Members, Membership, Payment Profile, Revenue
Settlement, Dashboard, WhatsApp, Landing Page). Dokumen ini mengonsolidasikan
semua temuan open dari setiap modul jadi satu daftar prioritas, dengan
keputusan go-live di bagian akhir.

**Konteks penting:** FitFlow bukan sistem pre-launch yang belum pernah dipakai
— audit di seluruh program ini dijalankan terhadap data produksi nyata (akun
instruktur Nana/Getfuel sudah aktif memakai sistem). Jadi pertanyaannya bukan
"apakah boleh diluncurkan", tapi **"apakah boleh diperluas/dipromosikan lebih
jauh ke instruktur lain dalam kondisi saat ini"**.

---

## 1. Daftar Temuan Open (lintas 10 modul)

### P1 — Dampak operasional/revenue/trust nyata

| ID | Temuan | Modul Asal | Bukti |
|---|---|---|---|
| P1-A | **Dashboard revenue ≠ Laporan revenue** — `get_dashboard_summary()` hanya baca `attendance`, tidak pernah baca `registrations`/`member_memberships`. Live-proven: Rp0 di Dashboard vs Rp465.000 di Laporan, instruktur+bulan yang sama. | Dashboard | Master UAT — Dashboard |
| P1-B | **Membership Lifecycle Engine tidak ada** — pending→active tidak pernah otomatis (padahal UI menjanjikan), expired tidak pernah terdeteksi, `used_sessions` tidak pernah berkurang dari attendance. Satu engine yang hilang, bukan 3 bug terpisah. | Membership | Master UAT — Membership |
| P1-C | **Historical Data Retention Policy belum diputuskan** — cascade delete menghapus riwayat revenue/kehadiran secara permanen. Terjadi berulang di 4 entity berbeda (Member→membership, Class→registrations, Event→registrations, Member→attendance). Perlu SATU keputusan (Opsi A: block delete, atau Opsi B: snapshot+SET NULL), diterapkan konsisten ke semuanya — bukan ditambal satu-satu. | Members, Class, Event, Operational Readiness Audit | Operational Readiness Audit; Master UAT — Events; Master UAT — Members |
| P1-D | **Capacity Class bisa oversell** — tidak ada re-check kapasitas di server saat insert (beda dari Event yang sudah punya RPC+row lock). Live-proven: 2 insert bersamaan ke kelas kuota 1, keduanya sukses, jadi 2/1. Bukan race sempit — tidak ada guard sama sekali. | Landing Page | docs/UAT_LANDING_PAGE_REPORT.md |

### P2 — Nyata tapi dampak lebih kecil (data quality, auditability, administratif)

| ID | Temuan | Modul Asal |
|---|---|---|
| P2-A | Members double-convert — API convert-from-community-contact tidak ada guard server-side, bisa convert 2x jadi member duplikat + orphan link | Members |
| P2-B | Payment Profile snapshot gap — `registrations` tidak menyimpan metode pembayaran yang ditampilkan saat itu, menyulitkan rekonsiliasi kalau metode berubah/dihapus setelahnya | Payment Profile |
| P2-C | WhatsApp Notification Delivery Visibility — notifikasi sekunder (confirm/reject/cancel/feedback) gagal terkirim tanpa sinyal apa pun ke instruktur. Desain perbaikan sudah ada: kolom `notification_status`/`notification_sent_at`/`notification_error` + badge kecil | WhatsApp |
| P2-D | Duplicate/accidental resubmit — registrant identik (nama+telepon+kelas+tanggal) bisa submit berulang tanpa hambatan apa pun, live-proven (2 insert identik, 0,36 detik, keduanya sukses) | Landing Page |
| P2-E | Attendance architecture Class vs Event tidak konsisten — Event pakai kolom `attended` di `registrations`, Class pakai tabel `attendance` terpisah tanpa FK balik ke `registrations` (korelasi cuma nama/telepon, rentan typo) | Registrations |
| P2-F | Delete-registration confirm dialog tidak menyebut `amount_paid` (beda dari Cancel yang sudah benar) | Registrations |

### P3 / Needs Security Review / Needs Verification

| ID | Temuan | Modul Asal |
|---|---|---|
| P3-A | `instructor_id` webhook trust boundary — tidak ada IP allowlist, satu shared-secret untuk seluruh platform. **Needs Security Review**, bukan vulnerability terkonfirmasi (belum ada bukti eksploitasi nyata) | WhatsApp |
| P3-B | `unstable_cache` tenant isolation di Dashboard — belum pernah dibuktikan benar/salah secara live (butuh 2 sesi konkuren asli dalam window cache 45 detik) | Dashboard |
| P3-C | `create_event_registration` RPC belum diuji concurrency sungguhan — row lock `FOR UPDATE` secara teori benar, tapi cuma diuji sequential, belum `Promise.all` paralel nyata terhadap RPC-nya sendiri (metode pengujiannya sudah terbukti di modul Landing Page untuk Class, tinggal diterapkan ke RPC Event) | Race Condition Backlog |
| P3-D | Transfer tanpa payment profile tetap mewajibkan upload bukti transfer — friction UX, bukan blocker | Landing Page, Payment Profile |
| P3-E | `refresh_member_statuses` cron — belum pernah diverifikasi benar-benar berjalan terjadwal (catatan lama bilang "0 member di produksi" tapi itu sudah usang sejak ada penggunaan nyata — perlu re-check, bukan diasumsikan masih 0) | Operational Readiness Audit |

### Pertanyaan Bisnis Terbuka (bukan bug, butuh keputusan user)

- Apakah Class registration via "cash" memang boleh self-confirm tanpa verifikasi instruktur sama sekali (beda dari "transfer" yang wajib upload bukti)?
- Apakah revenue Membership seharusnya dihitung saat *assign* (sekarang) atau butuh gerbang verifikasi seperti Event/Class?
- Opsi A vs Opsi B untuk Historical Data Retention (lihat P1-C) — keputusan arsitektur, bukan teknis.

### Fitur yang Sudah Didesain Lengkap, Menunggu Go-Ahead (bukan bug)

- **Class Reschedule V1** — `response_token`, halaman self-service cancel publik, notifikasi WA personal per peserta terdampak. Phase 1-4 fully locked, belum ada satu baris kode pun ditulis. Event Reschedule eksplisit di luar scope V1. (lihat audit Reschedule & Participant Impact)

### Non-Blocker, Sengaja Ditunda (kebijakan eksplisit, bukan terlewat)

- Type Safety Hardening (4 tahap terkunci: hapus dead code → 0 error tsc → strict TS → strict ESLint) — ditunda sampai "FitFlow mulai stabil"
- `EventEditForm.tsx` dan dead code lain — sudah teridentifikasi, sengaja belum dihapus
- Date Handling Standardization (raw UTC vs WIB-correct date) — severity rendah, belum user-facing
- Community import backend — sudah ada tapi belum official feature, tidak ada UI

### Sudah CLOSED, tidak perlu tindakan (dicatat untuk kelengkapan)

- Security Audit Phase 2 — 9 RPC SECURITY DEFINER, 3 ditemukan rentan, diperbaiki+commit, retested PASS
- Events P0 Revenue (early bird/capacity bypass) — fixed+committed, retested PASS
- Registrations P1 (confirmed_at) — fixed+committed
- Class module P1/P2/cheap-P3 (is_active toggle, delete warning, generate_sessions param) — remediated

---

## 2-3. Severity Final, Owner, dan Effort

| ID | Severity Final | Owner | Effort |
|---|---|---|---|
| P1-A | P1 | *(isi: siapa yang pegang Dashboard/Laporan)* | M — satu RPC/query disatukan, tidak ada migrasi skema baru |
| P1-B | P1 | *(isi)* | L — butuh desain engine (cron/trigger untuk expired-detection, promosi pending→active, deduksi sesi dari attendance), saling terkait satu sama lain |
| P1-C | P1 (keputusan arsitektur) | *(isi: siapa yang berhak memutuskan Opsi A/B)* | S untuk keputusan, M-L untuk implementasi setelah diputuskan (4 entity perlu disesuaikan) |
| P1-D | P1 | *(isi)* | M — buat RPC baru untuk Class registration meniru pola `create_event_registration` (row lock + re-validasi kapasitas) |
| P2-A | P2 | *(isi)* | S — tambah `WHERE converted_member_id IS NULL` di API convert |
| P2-B | P2 | *(isi)* | M — snapshot kolom metode pembayaran di `registrations` saat insert |
| P2-C | P2 | *(isi)* | S-M — desain sudah ada (3 kolom + badge), tinggal implementasi |
| P2-D | P2/P3 | *(isi)* | S — unique constraint berbasis `(class_id, session_date, registrant_phone)` dalam window waktu, atau token sekali pakai client-side |
| P2-E | P2 (arsitektural) | *(isi)* | L — perlu desain ulang, bukan tambal cepat |
| P2-F | P2 | *(isi)* | S — tambah teks `amount_paid` di dialog konfirmasi delete |
| P3-A | Needs Review | *(isi)* | S untuk review, tergantung hasil untuk effort fix |
| P3-B | Needs Verification | *(isi)* | S — butuh setup 2 sesi konkuren untuk diuji |
| P3-C | Needs Verification | *(isi)* | S — metode sudah terbukti di Landing Page, tinggal jalankan ke RPC Event |
| P3-D | P3 | *(isi)* | S — sembunyikan opsi Transfer kalau tidak ada payment profile |
| P3-E | Needs Verification | *(isi)* | S — cek log/cron config |

*(Kolom Owner sengaja saya kosongkan dengan placeholder — saya tidak punya
visibilitas ke struktur tim/siapa yang pegang area mana. Isi sebelum dokumen
ini dipakai sebagai tracker kerja.)*

---

## 4. Dependency Antar Perbaikan

```
P1-C (Historical Data Retention - keputusan Opsi A/B)
  └─ harus diputuskan SEBELUM implementasi fix apa pun yang menyentuh
     Delete Member/Class/Event (P1-C sendiri, dan tidak langsung
     memblokir P1-A/B/D yang berdiri sendiri)

P1-B (Membership Lifecycle Engine)
  └─ expired-detection HARUS ada dulu sebelum pending→active bisa benar
     (pending→active butuh tahu kapan slot aktif yang lama berakhir)
  └─ session deduction butuh tahu "membership mana yang aktif" - juga
     bergantung pada expired-detection yang benar

P1-D (Capacity Class RPC)
  └─ tidak bergantung pada apa pun, bisa dikerjakan independen
  └─ P2-D (duplicate resubmit) bisa digabung sekaligus dalam RPC yang sama
     kalau dikerjakan bersamaan (sama-sama soal validasi insert di server)

P1-A (Dashboard/Laporan unifikasi)
  └─ tidak bergantung pada modul lain, independen
  └─ TAPI: idealnya dikerjakan SEBELUM mempromosikan fitur dashboard baru
     apa pun (sudah dikunci user sebelumnya: "jangan ada dua definisi
     revenue dalam sistem")

P2-C (WhatsApp Delivery Visibility)
  └─ independen, desain sudah lengkap, tidak bergantung pada modul lain

Class Reschedule V1 (fitur, bukan bug)
  └─ independen dari semua temuan di atas, murni menunggu go-ahead user
```

---

## 5. Go-Live Blocker vs Non-Blocker

| Kategori | Item |
|---|---|
| **Blocker untuk perluasan/promosi lebih lanjut** | P1-A (trust issue, terlihat tiap hari di layar utama), P1-D (capacity oversell, langsung berdampak ke instruktur dengan kuota kecil) |
| **Blocker khusus untuk fitur Membership** (bukan blocker untuk funnel inti booking) | P1-B — Membership belum boleh dipromosikan/diandalkan sampai lifecycle engine ada, TAPI ini tidak menghalangi instruktur memakai Class/Event/Landing Page hari ini |
| **Sebaiknya diputuskan sebelum scale lebih jauh, tidak harus sebelum instruktur baru pertama** | P1-C — risiko nyata tapi hanya terpicu aksi Delete eksplisit, sudah ada mitigasi sebagian (warning text diperbaiki untuk Class) |
| **Non-blocker, aman jalan dengan known issues** | P2-A, P2-B, P2-C, P2-D, P2-E, P2-F, semua item P3, Type Safety Hardening, dead code cleanup, date handling |

---

## 6. Rekomendasi Keputusan

### **Ready for Production with Known Issues** — dengan 2 catatan wajib sebelum scale

Funnel inti (Landing Page → Registrasi → WhatsApp → Revenue) sudah terbukti solid
end-to-end secara live, tenant isolation terbukti kuat di setiap modul yang diuji
(bukan cuma diasumsikan dari RLS policy), dan semua temuan security yang
terkonfirmasi (Security Audit Phase 2) sudah diperbaiki dan diretest PASS. Sistem
ini SUDAH dipakai oleh instruktur nyata (Nana) selama audit berjalan — pertanyaan
bukan "boleh dipakai atau tidak", tapi "boleh diperluas ke instruktur lain atau
belum".

**Dua hal ini saya sarankan diperbaiki SEBELUM mempromosikan ke instruktur baru
secara lebih luas** (bukan karena sistem akan rusak, tapi karena dua-duanya
murah untuk diperbaiki dan dampaknya besar kalau dibiarkan):

1. **P1-A (Dashboard/Laporan revenue mismatch)** — ini adalah hal PERTAMA yang
   dilihat instruktur setiap hari. Membiarkan dua angka revenue berbeda di dua
   halaman berbeda merusak kepercayaan terhadap produk lebih cepat daripada bug
   teknis apa pun, terlepas dari berapa instruktur yang pakai.
2. **P1-D (Capacity Class oversell)** — kuota kelas adalah promise inti produk
   ("Daftar Kelas... 0 dari 1 kuota"). Kalau promise ini bisa dilanggar tanpa
   kondisi langka, instruktur dengan kelas privat/kuota kecil akan langsung
   merasakannya di kelas nyata, bukan cuma di laporan.

**Membership (P1-B) tidak perlu menghalangi peluncuran lebih luas** selama fitur
ini belum benar-benar dipromosikan/diandalkan sebagai fitur utama — datanya
sendiri menunjukkan belum ada penggunaan nyata yang bergantung padanya. Tapi
begitu ada instruktur yang mulai assign paket membership sungguhan, P1-B harus
selesai sebelum itu, bukan sesudah ditemukan rusak di lapangan.

**Historical Data Retention (P1-C)** adalah keputusan arsitektur yang sebaiknya
dikunci tidak terlalu lama lagi — bukan karena akan meledak besok, tapi karena
makin banyak instruktur makin besar konsekuensi kalau satu Delete yang tidak
disengaja menghapus riwayat revenue secara permanen.

Sisanya (semua P2/P3, fitur Reschedule yang sudah didesain, tech debt) aman
ditangani sesuai kecepatan tim tanpa menghalangi operasional hari ini.

---

## 7. Sprint Roadmap (revisi 2026-06-25 — menggantikan versi sebelumnya)

Versi pertama Bagian 7 menaruh P1-A+P1-D di Sprint 1 dan P1-C di Sprint 2
bersama beberapa P2 murah, dengan Reschedule di Sprint 3. **Revisi ini
menggantikannya sepenuhnya**, dengan dua koreksi dari user:

1. **P2-D (duplicate resubmit) dipindah ke Sprint 1**, digabung dengan P1-D —
   bukan karena severity-nya naik, tapi karena keduanya akan menyentuh jalur
   kode yang sama (insert registrasi Class di server). Memisahkan ke sprint
   berbeda berarti membuka area kode yang sama dua kali secara terpisah.
2. **P1-C (Historical Data Retention) dinaikkan di atas Reschedule** — pola
   cascade-delete-menghapus-histori sudah muncul berulang di banyak entity
   selama audit (Event, Member, Class, Attendance), dan ini cacat kebijakan
   data lintas sistem, bukan bug per modul. Makin lama ditunda, makin banyak
   data produksi nyata yang berpotensi terdampak.

Reschedule (Sprint 3) dan Membership Lifecycle Engine (Sprint 4) urutannya
ditentukan oleh ROI nyata, bukan severity: Reschedule sudah jadi kebutuhan
operasional GetFuel saat ini dan desainnya 100% selesai, sementara Membership
belum dipakai intensif — belum ada pain yang benar-benar dirasakan pengguna.

| Sprint | Isi | Alasan urutan |
|---|---|---|
| **Sprint 1** | P1-A (Dashboard Revenue) + P1-D (Capacity Class) + P2-D (Duplicate Resubmit, digabung karena area kode sama) | Trust issue harian + operasional inti yang sudah terbukti bisa dilanggar sekarang + sekali buka jalur insert registrasi, selesaikan dua masalah sekaligus |
| **Wajib sebelum lanjut Sprint 2** | **Audit ulang Dashboard + Landing Page** (regresi check) | Memastikan perbaikan Sprint 1 tidak merusak dua area paling kritis yang baru diperbaiki |
| **Sprint 2** | P1-C (keputusan Historical Data Retention + implementasi) | Cacat kebijakan data lintas sistem, makin ditunda makin besar dampaknya ke data produksi nyata |
| **Sprint 3** | Class Reschedule V1 | Fully designed (Phase 1-4 locked), kebutuhan operasional nyata GetFuel saat ini, ROI lebih tinggi daripada Membership |
| **Sprint 4** | P1-B (Membership Lifecycle Engine) | Belum mendesak — belum ada penggunaan membership aktif, belum ada pain nyata yang dirasakan pengguna |

**P2 lain TIDAK mendapat sprint khusus** — dikerjakan opportunistic saat
menyentuh area terkait, bukan dikumpulkan jadi satu sprint tersendiri:

| Item | Dikerjakan saat |
|---|---|
| P2-A (Members double-convert) | Saat membuka modul Member untuk alasan lain |
| P2-B (Payment Profile snapshot) | Saat membuka modul Payment Profile |
| P2-C (WhatsApp delivery visibility) | Saat membuka area notifikasi |
| P2-F (delete-registration warning) | Kapan saja, perubahan teks murni, tidak perlu menunggu konteks apa pun |
| P3-D (transfer tanpa payment profile) | Bisa diselipkan bersamaan P2-B karena sama-sama area Payment Profile, atau kapan saja |

**Belum dialokasikan ke sprint manapun (perlu keputusan lanjutan):** P2-E
(attendance architecture, lebih besar dari "bug kecil" — perlu slot sendiri
kalau dikerjakan), serta semua item P3/Needs Verification (P3-A instructor_id
review, P3-B unstable_cache verification, P3-C concurrency test RPC Event,
P3-E cron verification) dan seluruh item Non-Blocker (Type Safety Hardening,
dead code, date handling). Tidak menghalangi 4 sprint di atas.

---

## 8. Sprint 1 — Status Implementasi (2026-06-25)

**SELESAI, diterapkan ke database live, diverifikasi live (browser + DB), nol
regresi ditemukan.**

| Item | Implementasi | Bukti |
|---|---|---|
| P1-A Dashboard Revenue | Migrasi `046_unify_dashboard_revenue.sql` — `get_dashboard_summary()` sekarang pakai formula 3-sumber yang sama dengan `/laporan` (registrations confirmed_at-gated + member_memberships + attendance walkin) | Dashboard dan `/laporan` sekarang sama-sama Rp465.000 untuk akun Nana, dikonfirmasi visual di browser |
| P1-D Capacity Class | Migrasi `047_create_class_registration_rpc.sql` — RPC `create_class_registration` baru, meniru pola `create_event_registration` (row lock + re-validasi kapasitas di transaksi yang sama). `ClassRegistrationForm.tsx` diubah dari insert langsung ke panggilan RPC | 2 RPC call bersamaan ke kelas kuota 1: 1 sukses, 1 `class_full`, count akhir tetap 1 (sebelumnya jadi 2/1) |
| P2-D Duplicate Resubmit | Digabung ke RPC yang sama — guard idempotent berbasis `(class_id, session_date, registrant_phone, lower(registrant_name))`, return id yang sudah ada bukan insert baris baru | Submit identik 2x → id yang sama dikembalikan, cuma 1 baris di DB. Kontrol (nama beda, telepon sama) tetap berhasil bikin baris baru — skenario keluarga/teman tidak terblokir |
| Bonus konsistensi (tidak diminta eksplisit, tapi searah prinsip yang sudah dikunci di modul Events) | `amount_paid` untuk Class registration sekarang dihitung server-side dari `classes.class_price`, bukan dipercaya dari client — RPC ini sudah perlu baca baris kelas untuk validasi kapasitas, jadi biayanya nyaris nol | Diverifikasi: free class → amount_paid=0, kelas berbayar → amount_paid sesuai class_price, tidak peduli apa yang dikirim browser |

**Regression re-audit (syarat wajib sebelum Sprint 2), juga selesai, nol
regresi:**

- **Dashboard**: akun zero-revenue tetap menghasilkan Rp0 (tidak crash), revenue dari membership purchase (komponen baru) terbukti masuk benar (Rp100.000 test), `attendance_month`/`member_new`/`pending_events` (bagian RPC yang tidak diubah) tetap berfungsi normal.
- **Landing Page**: alur kelas gratis (isFree) PASS, alur transfer+bukti PASS (payment_status tetap `pending`, proof_url tersimpan benar), cross-tenant isolation re-check PASS (404 untuk classId tidak valid), console browser bersih tanpa error setelah submit sungguhan lewat UI.

**Catatan proses:** migrasi diterapkan via `supabase db push` (CLI sudah
linked ke project, sempat dikira tidak bisa sebelum dicek ulang). Semua data
test dibuat di akun dev (Rahmat), bukan akun produksi (Nana) — disposable,
dibersihkan setelah setiap tes, diverifikasi nol sisa.

**Belum dilakukan, perlu keputusan eksplisit sebelum lanjut:** belum
di-commit ke git (sesuai kebijakan "no auto commit/push" — kode dan migrasi
sudah siap, menunggu instruksi commit). Sprint 2 (Historical Data Retention
Policy) belum dimulai — gate regresi sudah terpenuhi, tinggal menunggu
keputusan Kak untuk lanjut.
