-- ─────────────────────────────────────────────────────────────────
-- 050_class_payment_methods_enabled.sql
-- Ditemukan saat UAT instruktur (2026-06-26): form pendaftaran kelas
-- publik SELALU menampilkan OTS dan Transfer berdampingan ke peserta,
-- tidak ada cara instruktur mematikan salah satu per kelas. Tujuan
-- transfer (rekening/QRIS) sudah bisa beda per kelas lewat
-- classes.payment_profile_id (037) - yang hilang murni "metode mana
-- yang ditawarkan sama sekali".
--
-- TEXT+CHECK (bukan Postgres ENUM type), konsisten dengan pola
-- payment_mode di migrasi 003 - lebih mudah diubah nanti (tambah opsi
-- ke-4 cuma ganti CHECK, bukan ALTER TYPE).
--
-- Default 'both' = perilaku semua kelas yang sudah ada tetap sama,
-- tidak ada backfill data yang diperlukan.
--
-- Catatan: ini KOLOM BARU, beda dari payment_mode (enum lama:
-- free/drop_in/prepaid/debt, dipakai flow membership/attendance) -
-- jangan tertukar saat grep.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS payment_methods_enabled TEXT NOT NULL DEFAULT 'both'
  CHECK (payment_methods_enabled IN ('both', 'ots_only', 'transfer_only'));
