# Master UAT — Module 10: Landing Page

Diaudit: 2026-06-25. Modul terakhir dari program Master UAT (Classes → Registrations →
Events → Members → Membership → Payment Profile → Revenue Settlement → Dashboard →
WhatsApp → **Landing Page**). Mengikuti pola Phase A (Mapping) → Phase B (Risk Map) →
Phase C (Browser + DB UAT live) → Phase D (Final Findings) yang sama dengan modul
sebelumnya.

Status: **Selesai diaudit. Tidak ada P0. Satu P1 baru (Capacity Class), satu P2/P3
(Duplicate Resubmit), satu P3 (Payment Profile UX friction).**

## Ringkasan Hasil

| # | Area | Klasifikasi | Severity |
|---|---|---|---|
| 1 | Cross-tenant isolation | PASS (live, 3 arah) | — |
| 2 | Visibility rules (inactive class, draft event) | PASS (live) | — |
| 3 | Registration integrity (orphan row) | PASS (DB constraint) | — |
| 4 | **Capacity Class** — tidak ada re-check di server saat insert | **CONFIRMED BUG** | **P1** |
| 5 | Capacity Event | PASS (RPC + row lock, sudah ada) | — |
| 6 | **Duplicate/accidental resubmit** — tidak ada idempotency guard | **CONFIRMED BUG** | **P2/P3** |
| 7 | Payment profile kosong/nonaktif (fallback) | PASS | — |
| 8 | WhatsApp failure tidak menghalangi transaksi | PASS | — |
| 9 | End-to-end: Landing → Registrasi → WA → Revenue | PASS | — |
| 10 | Dashboard tidak ikut menghitung revenue dari Landing Page | Existing Gap (cross-reference) | P1-A (sudah tercatat di modul Dashboard) |
| 11 | **Transfer tanpa payment profile** — tetap minta bukti transfer | CONFIRMED FRICTION | **P3** |

## Detail Temuan

### 1-3. Tenant isolation, visibility, integrity — PASS

Dibuktikan live, bukan cuma baca kode:

- Kelas instruktur A diakses lewat slug instruktur B → 404. Sebaliknya juga 404.
  Kelas A lewat slug A sendiri → 200 (kontrol positif).
- Kelas `is_active=false` dan event `status='draft'` → 404 saat diakses langsung,
  dan tidak muncul di listing landing page.
- `registrations_one_parent` CHECK constraint di database memastikan baris
  registrasi selalu punya tepat satu dari `class_id`/`event_id`, tidak pernah
  keduanya atau tidak ada sama sekali.

### 4. Capacity Class Oversell — CONFIRMED BUG, P1

**Temuan:** Event registration (`create_event_registration` RPC) sudah memvalidasi
kapasitas ulang di server dengan row lock (`SELECT ... FOR UPDATE`) sebelum insert.
Class registration **tidak punya RPC sama sekali** — form publik insert langsung
dari browser, kapasitas hanya dicek sekali saat halaman dimuat.

**Bukti live:** Kelas dengan kuota 1, 0 registrasi awal. Dua insert dijalankan
benar-benar bersamaan (`Promise.all`, anon key, persis pola yang dipakai form
asli). Hasil: **kedua insert sukses tanpa error apa pun**, kuota akhir jadi 2/1.

**Kenapa P1, bukan sekadar UX bug:** ini bukan race condition sempit yang butuh
timing presisi tinggi. Tidak ada guard apa pun di server, sehingga skenario yang
sama bisa terjadi walau dua submit berjarak beberapa menit — selama keduanya
memuat halaman saat status masih menunjukkan "tersedia". Untuk instruktur yang
menjual kelas dengan kuota kecil (kapasitas terbatas peralatan/ruangan), ini
risiko operasional nyata.

**Rekomendasi perbaikan:** buat RPC khusus untuk Class registration yang meniru
pola `create_event_registration` — row lock pada kelas + re-validasi kapasitas di
dalam transaksi yang sama dengan insert.

### 5. Capacity Event — PASS

Sudah diperbaiki dan dibuktikan live di modul Events sebelumnya (`commit 73c1684`).
Tidak diuji ulang dari nol di modul ini, cukup cross-reference.

### 6. Duplicate / Accidental Resubmit — CONFIRMED BUG, P2/P3

**Reframing penting:** pertanyaan yang benar bukan "apakah nomor HP boleh dipakai
dua kali" (itu valid — satu orang bisa mendaftarkan dirinya dan temannya pakai
nomor yang sama). Pertanyaan yang benar: **apakah registrant yang sama
(nama+telepon+kelas+tanggal identik) bisa submit berulang secara tidak sengaja
tanpa ada hambatan apa pun.**

**Bukti live:** payload identik (nama, telepon, class_id, session_date sama)
di-insert dua kali berjarak 0,36 detik. Kedua insert sukses, menghasilkan 2 baris
terpisah. Tidak ada unique constraint di DB, tidak ada validasi di aplikasi.

**Mitigasi yang sudah ada (tidak cukup untuk skenario realistis):** tombol submit
form punya `disabled={submitting}` yang mencegah double-click literal dalam satu
sesi form. Tapi ini tidak melindungi dari: tombol back browser setelah sukses,
submit ulang karena sinyal lambat di lokasi gym, atau refresh saat request masih
menggantung.

**Kenapa P2/P3, bukan P1:** dampaknya administratif (instruktur perlu cleanup
manual baris duplikat), bukan kebocoran data atau kerugian finansial langsung.
Tapi perbaikannya relatif murah, layak digabung sekaligus dengan perbaikan
Capacity Class.

**Rekomendasi perbaikan:** idempotency guard — unique key berbasis
`(class_id, session_date, registrant_phone)` dalam window waktu singkat, atau
token registrasi sekali pakai dari sisi client.

### 7-9. Payment profile fallback, WhatsApp failure, End-to-end — PASS

- Payment profile kosong sudah closed di modul Payment Profile sebelumnya.
- WhatsApp failure tidak menghalangi transaksi — konsisten dengan modul WhatsApp,
  mekanisme yang sama dipakai notifikasi publik.
- End-to-end dibuktikan live penuh: insert registrasi (anon, pola form asli) →
  trigger `sync_registration_confirmed_at` otomatis isi `confirmed_at` → muncul
  di `class_registration_summary` (daftar yang dilihat instruktur) → endpoint
  notifikasi WA dipanggil nyata (`sent:true`) → revenue Rp75.000 muncul benar di
  formula `/laporan`.

**Catatan transparansi:** panggilan WA pada tes end-to-end memicu pengiriman
nyata lewat nomor WhatsApp akun dev (Rahmat) ke nomor fiktif yang dibuat untuk
testing — bukan nomor asli siapa pun, tidak ada dampak ke pihak ketiga.

### 10. Dashboard tidak menghitung revenue dari Landing Page — Existing Gap

Reconfirm dari modul Dashboard: `get_dashboard_summary()` hanya membaca tabel
`attendance`, tidak pernah membaca `registrations`. Registrasi baru dari Landing
Page (kasus end-to-end di atas) muncul benar di `/laporan` tapi tidak di Dashboard.
Ini bukan temuan baru — sudah tercatat sebagai **P1-A** di modul Dashboard
(unifikasi definisi revenue Dashboard vs Laporan). Modul ini hanya membuktikan
gap yang sama juga berlaku untuk revenue yang berasal dari Landing Page, bukan
cuma dari aksi assign membership manual.

### 11. Transfer tanpa Payment Profile — CONFIRMED FRICTION, P3

**Bukti live (mobile viewport, 390px):** pada kelas yang tidak punya
`payment_profile_id` untuk transfer, memilih opsi "Transfer" menampilkan
peringatan **"Belum ada metode pembayaran tersedia. Hubungi instruktur langsung
untuk info pembayaran."** — tapi form tetap mewajibkan upload **"Bukti Transfer *"**
di bawahnya. Pengunjung bisa bingung: transfer ke mana?

Ini mengkonfirmasi ulang temuan minor yang sudah pernah ditemukan di modul
Payment Profile (saat itu di flow Event registrasi) — sekarang terbukti juga
terjadi di flow Class registrasi.

**Rekomendasi perbaikan:** kalau tidak ada payment profile aktif, sembunyikan
opsi Transfer beserta field bukti transfer sekalian — bukan cuma tampilkan
peringatan tapi tetap mewajibkan upload.

## Hal Lain yang Diperiksa, Hasil Bersih

- Tipe input nomor WhatsApp sudah `type="tel"` (keyboard numerik otomatis di mobile).
- Tombol CTA jelas dengan harga tertanam ("Daftar Sekarang · Rp 60.000").
- Link "Chat WhatsApp" membuka `wa.me` dengan pesan pre-filled yang ramah.
- Tidak ada overflow/layout pecah pada viewport 390px di semua halaman yang diuji.

## Disiplin Pembersihan Data Test

Semua data test (4 kelas, 1 event draft, beberapa registrasi disposable) dibuat di
bawah akun dev (Rahmat), bukan akun produksi (Nana). Slug sementara yang dipasang
untuk keperluan tes dikembalikan ke `null` setelah selesai. Diverifikasi ulang
setelah cleanup: nol kelas, nol event, nol registrasi tersisa di akun dev, slug
kembali ke kondisi semula.
