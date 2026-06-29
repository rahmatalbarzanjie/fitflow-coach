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

## 0. Update Log — 2026-06-29 (dokumen sebelumnya stale di beberapa poin)

Dicek ulang langsung ke `git log`, bukan diasumsikan dari catatan lama. Beberapa
item yang masih tertulis "open"/"belum dikerjakan" di bawah ternyata **sudah
closed** sejak dokumen ini ditulis (2026-06-25) — riwayat aslinya dipertahankan
di bawah untuk konteks, tapi status sekarang dikoreksi di setiap section:

- **P1-B (Membership Lifecycle Engine)** — CLOSED hari ini. Bukan cuma yang
  direncanakan Sprint 4 dulu (expired-detection + promosi pending→active +
  deduksi sesi), tapi lebih lengkap: ditambah booking-via-membership di landing
  page, cancel/refund auto-promote, dan refund-by-period revenue. Lihat §8a.
- **Class Reschedule V1** — sudah diimplementasi (commit `9fce383`, `f371507`,
  `a132043`, dan 2 fix lanjutan `0748395`, `674d8da`). Dokumen lama menulis
  "belum ada satu baris kode pun ditulis" — itu sudah tidak benar.
- **Participant Management: cancellation workflow** — sudah diimplementasi
  (commit `2fa010a`), termasuk fix P0 ownership-check (`9c12f14`). Item roadmap
  produk 2026-06-22 ini sudah selesai, bukan menggantung seperti catatan lama.
- **P1-A, P1-D, P2-D** — closed di Sprint 1 (sudah tercatat benar di §8, cuma
  tabel ringkasan §1 belum disesuaikan - sekarang sudah).
- **P1-C (Historical Data Retention)** — dicek ulang, **masih genuinely open**,
  tidak ada commit terkait sama sekali. Ini sekarang satu-satunya P1 yang
  tersisa di seluruh dokumen.

---

## 1. Daftar Temuan Open (lintas 10 modul)

### P1 — Dampak operasional/revenue/trust nyata

| ID | Temuan | Modul Asal | Bukti | Status |
|---|---|---|---|---|
| P1-A | **Dashboard revenue ≠ Laporan revenue** — `get_dashboard_summary()` hanya baca `attendance`, tidak pernah baca `registrations`/`member_memberships`. Live-proven: Rp0 di Dashboard vs Rp465.000 di Laporan, instruktur+bulan yang sama. | Dashboard | Master UAT — Dashboard | **CLOSED** — lihat §8 |
| P1-B | **Membership Lifecycle Engine tidak ada** — pending→active tidak pernah otomatis (padahal UI menjanjikan), expired tidak pernah terdeteksi, `used_sessions` tidak pernah berkurang dari attendance. Satu engine yang hilang, bukan 3 bug terpisah. | Membership | Master UAT — Membership | **CLOSED 2026-06-29** — lihat §8a |
| P1-C | **Historical Data Retention Policy belum diputuskan** — cascade delete menghapus riwayat revenue/kehadiran secara permanen. Terjadi berulang di 4 entity berbeda (Member→membership, Class→registrations, Event→registrations, Member→attendance). Perlu SATU keputusan (Opsi A: block delete, atau Opsi B: snapshot+SET NULL), diterapkan konsisten ke semuanya — bukan ditambal satu-satu. | Members, Class, Event, Operational Readiness Audit | Operational Readiness Audit; Master UAT — Events; Master UAT — Members | **OPEN — satu-satunya P1 yang tersisa** |
| P1-D | **Capacity Class bisa oversell** — tidak ada re-check kapasitas di server saat insert (beda dari Event yang sudah punya RPC+row lock). Live-proven: 2 insert bersamaan ke kelas kuota 1, keduanya sukses, jadi 2/1. Bukan race sempit — tidak ada guard sama sekali. | Landing Page | docs/UAT_LANDING_PAGE_REPORT.md | **CLOSED** — lihat §8 |

### P2 — Nyata tapi dampak lebih kecil (data quality, auditability, administratif)

| ID | Temuan | Modul Asal | Status |
|---|---|---|---|
| P2-A | Members double-convert — API convert-from-community-contact tidak ada guard server-side, bisa convert 2x jadi member duplikat + orphan link | Members | Open |
| P2-B | Payment Profile snapshot gap — `registrations` tidak menyimpan metode pembayaran yang ditampilkan saat itu, menyulitkan rekonsiliasi kalau metode berubah/dihapus setelahnya | Payment Profile | Open |
| P2-C | WhatsApp Notification Delivery Visibility — notifikasi sekunder (confirm/reject/cancel/feedback) gagal terkirim tanpa sinyal apa pun ke instruktur. Desain perbaikan sudah ada: kolom `notification_status`/`notification_sent_at`/`notification_error` + badge kecil | WhatsApp | Open |
| P2-D | Duplicate/accidental resubmit — registrant identik (nama+telepon+kelas+tanggal) bisa submit berulang tanpa hambatan apa pun, live-proven (2 insert identik, 0,36 detik, keduanya sukses) | Landing Page | **CLOSED** — lihat §8 |
| P2-E | Attendance architecture Class vs Event tidak konsisten — Event pakai kolom `attended` di `registrations`, Class pakai tabel `attendance` terpisah tanpa FK balik ke `registrations` (korelasi cuma nama/telepon, rentan typo) | Registrations | Open |
| P2-F | Delete-registration confirm dialog tidak menyebut `amount_paid` (beda dari Cancel yang sudah benar) | Registrations | Open |

### P3 — Temuan baru dari audit domain Membership (2026-06-29), sengaja dijadikan backlog

Ditemukan saat menutup P1-B, bukan blocker untuk penutupan itu sendiri — dicatat
di sini supaya tidak hilang, bukan diam-diam diasumsikan selesai:

| ID | Temuan | Status |
|---|---|---|
| P3-F | **Upgrade/downgrade membership** — tidak ada mekanisme proration/transfer sisa sesi antar `package_id` berbeda. Sengaja dikeluarkan dari scope Sprint Membership Hardening (eksplisit JANGAN dari user). Tunda sampai ada kebutuhan nyata, sama seperti keputusan awal di `docs/MEMBERSHIP_LIFECYCLE_ENGINE_DESIGN.md` §7 Tahap 3. | Deferred by design |
| P3-G | **Revenue Sharing per-instruktur untuk konsumsi membership** — nol implementasi. Sama seperti P3-F, ditunda sampai ada instruktur yang benar-benar butuh bagi hasil membership (Tahap 3 dokumen desain). | Deferred by design |
| P3-H | **Membership Sale belum punya `payment_status`/`confirmed_at`** seperti Registration (instruktur input penjualan dianggap selalu lunas seketika, tidak ada gerbang "uang belum benar-benar masuk"). Tahap 4 dokumen desain, ditandai non-urgent sejak awal. | Deferred by design |
| P3-I | `AssignPackageForm.tsx` tidak validasi `purchase_price` negatif atau `class_type` aneh secara server-side — risiko rendah (cuma instruktur sendiri yang isi form ini, bukan permukaan publik). | Open, low priority |
| P3-J | pg_cron job baru `membership-nightly-sweep` (expired + pending-promotion) terdaftar tanpa error dan terbukti bisa dipanggil manual, tapi eksekusi otomatis terjadwalnya **belum pernah diobservasi langsung** (tidak ada akses untuk query tabel `cron.job` dari environment ini). Sama kelas masalahnya dengan P3-E di bawah — cek lagi setelah berjalan beberapa hari. | Needs Verification |

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
- ~~Apakah revenue Membership seharusnya dihitung saat *assign* atau butuh gerbang verifikasi seperti Event/Class?~~ — sebagian terjawab 2026-06-29: revenue tetap diakui saat assign (cash-basis, locked di `MEMBERSHIP_LIFECYCLE_ENGINE_DESIGN.md` §5), TAPI refund sekarang dipotong di periode refund terjadi, bukan periode pembelian. Gerbang `payment_status` penuh seperti Event/Class masih terbuka (lihat P3-H).
- Opsi A vs Opsi B untuk Historical Data Retention (lihat P1-C) — keputusan arsitektur, bukan teknis. **Satu-satunya pertanyaan bisnis yang masih murni terbuka di dokumen ini.**

### Fitur yang Sudah Didesain Lengkap, Menunggu Go-Ahead (bukan bug)

*(kosong — Class Reschedule V1, satu-satunya item di kategori ini, sudah closed, lihat di bawah)*

### Non-Blocker, Sengaja Ditunda (kebijakan eksplisit, bukan terlewat)

- Type Safety Hardening (4 tahap terkunci: hapus dead code → 0 error tsc → strict TS → strict ESLint) — ditunda sampai "FitFlow mulai stabil"
- `EventEditForm.tsx` dan dead code lain — sudah teridentifikasi, sengaja belum dihapus
- Date Handling Standardization (raw UTC vs WIB-correct date) — severity rendah, belum user-facing
- Community import backend — sudah ada tapi belum official feature, tidak ada UI
- P3-F, P3-G, P3-H (Membership upgrade/downgrade, revenue sharing, Sale payment_status gate) — lihat tabel P3 di atas

### Sudah CLOSED, tidak perlu tindakan (dicatat untuk kelengkapan)

- Security Audit Phase 2 — 9 RPC SECURITY DEFINER, 3 ditemukan rentan, diperbaiki+commit, retested PASS
- Events P0 Revenue (early bird/capacity bypass) — fixed+committed, retested PASS
- Registrations P1 (confirmed_at) — fixed+committed
- Class module P1/P2/cheap-P3 (is_active toggle, delete warning, generate_sessions param) — remediated
- **P1-A, P1-D, P2-D** (Dashboard Revenue, Capacity Class oversell, Duplicate Resubmit) — Sprint 1, fixed+verified live, lihat §8
- **P1-B (Membership Lifecycle Engine)** — CLOSED 2026-06-29 lewat 2 sprint berurutan (Booking + Hardening), lihat §8a. Migrasi sudah diterapkan ke database live; **belum di-commit ke git** per kebijakan "no auto commit/push" — perlu satu langkah commit eksplisit sebelum dianggap benar-benar selesai end-to-end.
- **Class Reschedule V1** — sudah diimplementasi (commit `9fce383`, `f371507`, `a132043`), termasuk 2 fix lanjutan pasca-launch (`0748395`, `674d8da`). Dokumen versi 2026-06-25 menulis ini sebagai "menunggu go-ahead" — itu sudah usang.
- **Participant Management: cancellation workflow** — sudah diimplementasi (commit `2fa010a`) plus fix P0 ownership-check (`9c12f14`). Item roadmap produk 2026-06-22 ini selesai.

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

## 5. Go-Live Blocker vs Non-Blocker (diperbarui 2026-06-29)

| Kategori | Item |
|---|---|
| **Blocker untuk perluasan/promosi lebih lanjut** | ~~P1-A, P1-D~~ — **CLOSED**, tidak lagi blocker. |
| **Blocker khusus untuk fitur Membership** | ~~P1-B~~ — **CLOSED**. Membership sekarang boleh dipromosikan/diandalkan sebagai fitur utama. |
| **Sebaiknya diputuskan sebelum scale lebih jauh, tidak harus sebelum instruktur baru pertama** | **P1-C — satu-satunya item di kategori ini sekarang**, dan satu-satunya P1 yang masih open di seluruh dokumen. Risiko nyata tapi hanya terpicu aksi Delete eksplisit, sudah ada mitigasi sebagian (warning text diperbaiki untuk Class). |
| **Non-blocker, aman jalan dengan known issues** | P2-A, P2-B, P2-C, P2-E, P2-F, P3-F sampai P3-J, Type Safety Hardening, dead code cleanup, date handling. (P2-D sudah closed, dihapus dari daftar ini.) |

**Ringkasan:** dari 4 P1 awal, **3 sudah closed**. P1-C adalah satu-satunya
hal yang berdiri antara kondisi sekarang dan "tidak ada P1 terbuka sama
sekali" di seluruh program audit ini.

---

## 6. Rekomendasi Keputusan (diperbarui 2026-06-29)

### **Ready for Production with Known Issues** — dengan 1 catatan wajib sebelum scale (sebelumnya 2)

Funnel inti (Landing Page → Registrasi → WhatsApp → Revenue) sudah terbukti solid
end-to-end secara live, tenant isolation terbukti kuat di setiap modul yang diuji
(bukan cuma diasumsikan dari RLS policy), dan semua temuan security yang
terkonfirmasi (Security Audit Phase 2) sudah diperbaiki dan diretest PASS. Sistem
ini SUDAH dipakai oleh instruktur nyata (Nana) selama audit berjalan — pertanyaan
bukan "boleh dipakai atau tidak", tapi "boleh diperluas ke instruktur lain atau
belum".

~~Dua hal ini saya sarankan diperbaiki SEBELUM mempromosikan ke instruktur baru~~
**P1-A dan P1-D sudah closed** (Sprint 1, lihat §8) — rekomendasi lama di sini
sudah terpenuhi, tidak ada tindakan lagi yang dibutuhkan untuk keduanya.

**Membership (P1-B) juga sudah closed** (2026-06-29, lihat §8a) — fitur ini
sekarang boleh dipromosikan/diandalkan sebagai fitur utama, termasuk booking
mandiri via landing page dan refund yang terkoreksi benar di Laporan.

**Historical Data Retention (P1-C) adalah satu-satunya hal yang tersisa di
kategori ini.** Rekomendasi tidak berubah dari versi sebelumnya: sebaiknya
dikunci tidak terlalu lama lagi — bukan karena akan meledak besok, tapi karena
makin banyak instruktur makin besar konsekuensi kalau satu Delete yang tidak
disengaja menghapus riwayat revenue secara permanen. **Ini sekarang Sprint
satu-satunya yang belum dimulai dari seluruh roadmap §7.**

Sisanya (semua P2/P3, tech debt) aman ditangani sesuai kecepatan tim tanpa
menghalangi operasional hari ini.

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

| Sprint | Isi | Alasan urutan | Status (2026-06-29) |
|---|---|---|---|
| **Sprint 1** | P1-A (Dashboard Revenue) + P1-D (Capacity Class) + P2-D (Duplicate Resubmit, digabung karena area kode sama) | Trust issue harian + operasional inti yang sudah terbukti bisa dilanggar sekarang + sekali buka jalur insert registrasi, selesaikan dua masalah sekaligus | **DONE** — lihat §8 |
| **Wajib sebelum lanjut Sprint 2** | **Audit ulang Dashboard + Landing Page** (regresi check) | Memastikan perbaikan Sprint 1 tidak merusak dua area paling kritis yang baru diperbaiki | **DONE** — lihat §8 |
| **Sprint 2** | P1-C (keputusan Historical Data Retention + implementasi) | Cacat kebijakan data lintas sistem, makin ditunda makin besar dampaknya ke data produksi nyata | **BELUM DIMULAI — satu-satunya sprint yang tersisa** |
| **Sprint 3** | Class Reschedule V1 | Fully designed (Phase 1-4 locked), kebutuhan operasional nyata GetFuel saat ini, ROI lebih tinggi daripada Membership | **DONE** (commit `9fce383`, `f371507`, `a132043`, + fix `0748395`, `674d8da`) |
| **Sprint 4** | P1-B (Membership Lifecycle Engine) | Belum mendesak — belum ada penggunaan membership aktif, belum ada pain nyata yang dirasakan pengguna | **DONE 2026-06-29** — lihat §8a. Dikerjakan lebih luas dari rencana asli (Sprint 4 cuma expired/promosi/deduksi; realisasinya juga menambah booking-via-membership di landing page + refund architecture) |

**Path ke depan sekarang terukur dengan jelas: tinggal Sprint 2 (P1-C) yang
belum dikerjakan dari seluruh 4 sprint di roadmap ini.** Setelah itu, satu-
satunya pekerjaan terstruktur yang tersisa adalah backlog P2/P3 (dikerjakan
opportunistic, lihat tabel di bawah, tidak butuh sprint khusus).

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
sudah siap, menunggu instruksi commit). *(Catatan susulan: ini sudah
di-commit belakangan — `b4832e4` — dicek lewat `git log`. Sprint 2 di bawah
masih akurat: belum dimulai.)*

---

## 8a. Sprint 4 (Membership Lifecycle Engine) — Status Implementasi (2026-06-29)

**SELESAI, diterapkan ke database live, diverifikasi live (RPC langsung
terhadap data Getfuel asli, data uji selalu dibersihkan setelah tiap tes).
Dikerjakan dalam 2 sprint berurutan, lebih luas dari rencana Sprint 4 asli.**

### Sprint Membership Booking — migrasi 058-061

Gap yang ditutup: member yang sudah punya paket aktif tidak bisa memakainya
saat daftar kelas sendiri lewat landing page (selalu diarahkan ke alur bayar).

| Item | Implementasi |
|---|---|
| Pengenalan member by phone | `find_member_by_phone` (058) — pola dua-varian nomor (lokal/internasional) yang sudah dipakai `wa/incoming` route |
| Eligibility check | `member_membership_eligible` (058/061) — membership aktif, class_type cocok, sisa sesi > 0 untuk session_pack |
| RPC publik untuk live-check di form | `check_membership_eligibility` (058) |
| `create_class_registration` diperluas | Member eligible → `member_id` ter-set, `payment_status='confirmed'`, `amount_paid=0`, tidak perlu bayar. Member match tapi tidak eligible → tetap ditandai member (untuk badge), tetap alur OTS |
| **2 bug ditemukan+diperbaiki saat verifikasi live** | (1) Helper internal masih bisa dipanggil anon langsung (kebocoran data member) → di-revoke (060). (2) RPC utama error "ambiguous column" karena nama kolom return bentrok nama kolom tabel → dikualifikasi (061) |

### Sprint Membership Hardening — migrasi 062-067

Gap yang ditutup: hasil audit domain lifecycle (cancel tidak promosikan
pending, expired tidak pernah terdeteksi, promosi tidak hormat `start_date`,
cancel tidak koreksi revenue).

| Item | Implementasi |
|---|---|
| Cancel auto-promote pending | `cancel_membership` RPC (063, fix bug di 066) |
| Expired lifecycle engine | `nightly_membership_sweep()` + `pg_cron` baru, 00:30 WIB tiap hari (064) |
| Promosi hormat `start_date` | Primitive `promote_next_eligible_pending`, dipakai bersama oleh cancel/exhaustion/sweep (063) |
| Refund architecture | Kolom `refund_amount`/`refund_reason`/`refunded_at` + CHECK constraint (062), RPC `refund_membership` (063) — refund pada membership masih aktif/pending otomatis ikut cancel+promote |
| Refund attribusi periode | Awalnya refund dikurangkan di periode PEMBELIAN (065) — dikoreksi user 2026-06-29 jadi periode REFUND terjadi (067), sesuai cara owner fitness mikir ("bulan ini keluar uang berapa") |
| Friendly error duplicate active | `AssignPackageForm.tsx` tangkap kode `23505`, ganti pesan raw Postgres |
| **1 bug ditemukan+diperbaiki saat verifikasi live** | `cancel_membership` awalnya pakai `RETURNING (status='active')` yang ternyata selalu evaluasi baris SETELAH update (selalu false) — promosi tidak pernah benar-benar terpanggil. Fix di 066: tangkap status lama via `SELECT ... FOR UPDATE` dulu. |

**Temuan baru yang sengaja TIDAK ditutup di sprint ini** (lihat tabel P3-F
s/d P3-J di §1): upgrade/downgrade, revenue sharing per-instruktur, gerbang
`payment_status` untuk Membership Sale, validasi minor `AssignPackageForm`,
dan verifikasi eksekusi otomatis `pg_cron` yang belum diobservasi langsung.

**Belum dilakukan, sama seperti Sprint 1:** migrasi 058-067 sudah diterapkan
ke database live (`supabase db push`) dan diverifikasi, **tapi belum
di-commit ke git** — kode (komponen React, types) dan SQL (10 file migrasi)
menunggu instruksi commit eksplisit, sesuai kebijakan yang sama dengan Sprint
1 dulu.

---

## 9. Sprint 2 (Historical Data Retention) — belum dimulai

Tidak ada perubahan dari rencana di §7 — dicatat di sini supaya jelas ini
BUKAN diam-diam terlewat, hanya genuinely belum dikerjakan. Kalau ingin
dilanjutkan, langkah pertamanya adalah keputusan Opsi A (block delete) vs
Opsi B (snapshot+SET NULL) di P1-C — bukan langsung implementasi, karena
4 entity (Member→membership, Class→registrations, Event→registrations,
Member→attendance) butuh pendekatan yang sama, bukan ditambal satu-satu.
