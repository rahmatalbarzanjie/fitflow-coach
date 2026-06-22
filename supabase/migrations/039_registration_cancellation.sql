-- ─────────────────────────────────────────────────────────────────
-- 039_registration_cancellation.sql
-- Participant Management: tambah status "cancelled" untuk registrasi
-- individual (BUKAN "rejected" - rejected = instruktur menilai bukti
-- pembayaran tidak valid, cancelled = pendaftaran dibatalkan/ditarik,
-- baik sebelum maupun setelah pembayaran dikonfirmasi).
--
-- Ditaruh di migration terpisah dari 040 (yang memakai nilai enum ini
-- di body function) - menambah enum value dan memakainya di transaksi
-- yang sama bisa bermasalah di Postgres.
-- ─────────────────────────────────────────────────────────────────

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
