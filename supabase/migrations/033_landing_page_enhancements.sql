-- ─────────────────────────────────────────────────────────────────
-- 033_landing_page_enhancements.sql
-- Landing Page Enhancement Sprint:
--   - Link Google Maps untuk classes & events (URL saja, bukan lat/long)
--   - Dokumentasi kelas (class_gallery) & dokumentasi event (event_gallery)
-- ─────────────────────────────────────────────────────────────────

-- ── Google Maps link (opsional, tidak mengganti kolom location) ───
ALTER TABLE classes ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- ── Dokumentasi Kelas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_gallery (
  id         UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE class_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_gallery: select own"
  ON class_gallery FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "class_gallery: insert own"
  ON class_gallery FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "class_gallery: update own"
  ON class_gallery FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "class_gallery: delete own"
  ON class_gallery FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_class_gallery_class
  ON class_gallery(class_id, sort_order);

-- ── Dokumentasi Event ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_gallery (
  id         UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_gallery: select own"
  ON event_gallery FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "event_gallery: insert own"
  ON event_gallery FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_gallery: update own"
  ON event_gallery FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "event_gallery: delete own"
  ON event_gallery FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_event_gallery_event
  ON event_gallery(event_id, sort_order);

-- ── Storage buckets untuk dokumentasi (publik, dibaca landing page) ─
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('class-gallery', 'class-gallery', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('event-gallery', 'event-gallery', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── class-gallery ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "class_gallery_public_read" ON storage.objects;
DROP POLICY IF EXISTS "class_gallery_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "class_gallery_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "class_gallery_auth_delete" ON storage.objects;

CREATE POLICY "class_gallery_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'class-gallery');

CREATE POLICY "class_gallery_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'class-gallery'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "class_gallery_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'class-gallery'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "class_gallery_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'class-gallery'
    AND auth.role() = 'authenticated'
  );

-- ── event-gallery ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "event_gallery_public_read" ON storage.objects;
DROP POLICY IF EXISTS "event_gallery_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "event_gallery_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "event_gallery_auth_delete" ON storage.objects;

CREATE POLICY "event_gallery_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-gallery');

CREATE POLICY "event_gallery_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'event-gallery'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "event_gallery_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'event-gallery'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "event_gallery_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'event-gallery'
    AND auth.role() = 'authenticated'
  );
