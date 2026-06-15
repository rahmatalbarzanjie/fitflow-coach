-- ============================================================
-- Migration 006: Storage Buckets & RLS Policies
-- ============================================================
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Buat semua bucket yang diperlukan (skip jika sudah ada)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('instructor-photos', 'instructor-photos', true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('member-photos',     'member-photos',     true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('event-covers',      'event-covers',      true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('payment-proofs',    'payment-proofs',    false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ── instructor-photos ─────────────────────────────────────────
DROP POLICY IF EXISTS "instructor_photos_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "instructor_photos_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "instructor_photos_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "instructor_photos_auth_delete"  ON storage.objects;

CREATE POLICY "instructor_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'instructor-photos');

CREATE POLICY "instructor_photos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'instructor-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "instructor_photos_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'instructor-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "instructor_photos_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'instructor-photos'
    AND auth.role() = 'authenticated'
  );

-- ── member-photos ─────────────────────────────────────────────
DROP POLICY IF EXISTS "member_photos_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "member_photos_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "member_photos_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "member_photos_auth_delete"  ON storage.objects;

CREATE POLICY "member_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'member-photos');

CREATE POLICY "member_photos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'member-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "member_photos_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'member-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "member_photos_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'member-photos'
    AND auth.role() = 'authenticated'
  );

-- ── event-covers ──────────────────────────────────────────────
DROP POLICY IF EXISTS "event_covers_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "event_covers_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "event_covers_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "event_covers_auth_delete"  ON storage.objects;

CREATE POLICY "event_covers_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-covers');

CREATE POLICY "event_covers_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'event-covers'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "event_covers_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'event-covers'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "event_covers_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'event-covers'
    AND auth.role() = 'authenticated'
  );

-- ── payment-proofs (private — hanya pemilik & instruktur) ─────
DROP POLICY IF EXISTS "payment_proofs_auth_read"   ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_anon_insert"  ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_auth_delete"  ON storage.objects;

-- Siapapun yang authenticated bisa baca (instruktur perlu lihat bukti)
CREATE POLICY "payment_proofs_auth_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
  );

-- Siapapun (termasuk anon) bisa upload bukti — peserta belum tentu login
CREATE POLICY "payment_proofs_anon_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "payment_proofs_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
  );

-- ── Verifikasi ────────────────────────────────────────────────
SELECT
  policyname,
  cmd,
  tablename
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
ORDER BY policyname;
