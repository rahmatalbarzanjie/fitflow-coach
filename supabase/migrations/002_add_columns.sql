-- ============================================================
-- FitFlow Coach - Migration 002: tambah kolom baru
-- Jalankan di Supabase SQL Editor
-- Aman diulang (IF NOT EXISTS)
-- ============================================================

-- 1. Deskripsi kelas (tampil di landing page)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Subscription management untuk instruktur
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- Set default trial 30 hari untuk profil yang sudah ada dan belum punya nilai
UPDATE profiles
SET trial_expires_at = NOW() + INTERVAL '30 days'
WHERE trial_expires_at IS NULL;

-- ============================================================
-- Storage: Buat bucket event-covers (jalankan manual atau via dashboard)
-- ============================================================
-- Di Supabase Dashboard → Storage → New Bucket:
--   Name: event-covers
--   Public bucket: ✓ (centang)
--
-- Atau via SQL (jika storage extension aktif):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('event-covers', 'event-covers', true)
-- ON CONFLICT (id) DO NOTHING;

-- RLS policy untuk event-covers (siapa saja bisa baca, instruktur bisa upload)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE policyname = 'event_covers_public_read' AND tablename = 'objects'
--   ) THEN
--     CREATE POLICY event_covers_public_read ON storage.objects
--       FOR SELECT USING (bucket_id = 'event-covers');
--
--     CREATE POLICY event_covers_auth_upload ON storage.objects
--       FOR INSERT WITH CHECK (
--         bucket_id = 'event-covers' AND auth.role() = 'authenticated'
--       );
--
--     CREATE POLICY event_covers_owner_delete ON storage.objects
--       FOR DELETE USING (
--         bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]
--       );
--   END IF;
-- END $$;
