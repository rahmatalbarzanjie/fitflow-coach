-- ─────────────────────────────────────────────────────────────────
-- 044_fix_registration_confirmed_at_sync.sql
-- P1 Revenue bug - confirmed 2026-06-24 via live reproduction (Master
-- UAT Registrations Wave 1).
--
-- ClassRegistrationForm.tsx sets payment_status='confirmed' directly
-- for cash/free registrations (self-declared, no instructor proof
-- check) but never sets confirmed_at. /laporan (Revenue Settlement)
-- filters strictly on confirmed_at IS NOT NULL, so this money was
-- silently invisible to revenue reporting. Confirmed live: 10 real
-- production rows affected, Rp 400.000 total.
--
-- Fix is structural rather than patching each client call site -
-- a trigger fills confirmed_at whenever payment_status='confirmed'
-- and confirmed_at is still NULL, on INSERT or UPDATE. Never
-- overwrites an existing value, so confirm_registration (which
-- already sets both fields together) is unaffected/idempotent.
-- Closes this class of bug for any future code path too, not just
-- the one found today.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_registration_confirmed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_status = 'confirmed' AND NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registration_confirmed_at ON registrations;
CREATE TRIGGER trg_sync_registration_confirmed_at
  BEFORE INSERT OR UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION sync_registration_confirmed_at();

-- Backfill baris produksi yang sudah terdampak - pakai registered_at
-- sebagai proksi terbaik (saat itulah peserta self-declare pembayaran),
-- bukan NOW() yang akan keliru waktunya.
UPDATE registrations
SET confirmed_at = registered_at
WHERE payment_status = 'confirmed' AND confirmed_at IS NULL;
