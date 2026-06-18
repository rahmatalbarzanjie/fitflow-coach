-- ============================================================
-- FitFlow Coach - Migration 003: Feature Additions
-- Jalankan di Supabase SQL Editor (aman diulang - IF NOT EXISTS)
-- ============================================================

-- ────────────────────────────────────────────
-- 1. EVENTS: harga bertingkat + info bank + flyer
-- ────────────────────────────────────────────

-- Pricing mode: 'tiered' (gelombang) or 'single'
ALTER TABLE events ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'tiered';

-- Tier labels (mapping: tier1 = early_bird, tier2 = ots)
ALTER TABLE events ADD COLUMN IF NOT EXISTS tier1_label TEXT DEFAULT 'Early Bird';
ALTER TABLE events ADD COLUMN IF NOT EXISTS tier2_label TEXT DEFAULT 'Regular';

-- Cover / flyer image
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Bank info untuk instruksi pembayaran
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_name           TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_account_name   TEXT;

-- ────────────────────────────────────────────
-- 2. CLASSES: payment mode + harga per kelas
-- ────────────────────────────────────────────

-- Deskripsi kelas (tampil di landing page)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description TEXT;

-- Mode pembayaran: 'free', 'cash', 'transfer'
ALTER TABLE classes ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'free';

-- Nominal harga kelas (null jika free)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_price NUMERIC DEFAULT 0;

-- ────────────────────────────────────────────
-- 3. MEMBERS: foto profil
-- ────────────────────────────────────────────

ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ────────────────────────────────────────────
-- 4. PROFILES: subscription management
-- ────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_expires_at    TIMESTAMPTZ;

-- Set trial 30 hari untuk profil yang sudah ada
UPDATE profiles
SET trial_expires_at = NOW() + INTERVAL '30 days'
WHERE trial_expires_at IS NULL;

-- ============================================================
-- STORAGE BUCKETS - Buat manual di Supabase Dashboard:
-- Storage → New Bucket → isi nama → centang "Public bucket"
--
-- Bucket yang diperlukan:
--   1. event-covers   (public) - flyer / cover event
--   2. member-photos  (public) - foto profil member
--   3. payment-proofs (public) - bukti transfer peserta
--
-- Atau jalankan SQL berikut jika ekstensi storage aktif:
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES
--   ('event-covers',   'event-covers',   true),
--   ('member-photos',  'member-photos',  true),
--   ('payment-proofs', 'payment-proofs', true)
-- ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────
-- 5. RLS POLICY untuk storage (jika belum ada)
-- ────────────────────────────────────────────

-- Semua bucket di atas: public read, auth upload, owner delete
-- Buat di Supabase Dashboard → Storage → Policies
-- Atau uncomment dan jalankan:

-- DO $$
-- DECLARE
--   buckets TEXT[] := ARRAY['event-covers', 'member-photos', 'payment-proofs'];
--   b TEXT;
-- BEGIN
--   FOREACH b IN ARRAY buckets LOOP
--     BEGIN
--       EXECUTE format(
--         'CREATE POLICY "%s_public_read" ON storage.objects FOR SELECT USING (bucket_id = %L)',
--         b, b
--       );
--     EXCEPTION WHEN duplicate_object THEN NULL;
--     END;
--     BEGIN
--       EXECUTE format(
--         'CREATE POLICY "%s_auth_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = %L AND auth.role() = ''authenticated'')',
--         b, b
--       );
--     EXCEPTION WHEN duplicate_object THEN NULL;
--     END;
--     BEGIN
--       EXECUTE format(
--         'CREATE POLICY "%s_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = %L AND auth.role() = ''authenticated'')',
--         b, b
--       );
--     EXCEPTION WHEN duplicate_object THEN NULL;
--     END;
--   END LOOP;
-- END $$;
