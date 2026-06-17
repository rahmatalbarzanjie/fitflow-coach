-- Biografi instruktur (tampil di landing page di bawah nama)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- 1 foto cover per kelas (tampil di jadwal landing page)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Testimoni peserta, dikelola instruktur, ditampilkan di landing page
CREATE TABLE IF NOT EXISTS testimonials (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  content      TEXT NOT NULL,
  photo_url    TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials: select own" ON testimonials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "testimonials: insert own" ON testimonials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "testimonials: update own" ON testimonials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "testimonials: delete own" ON testimonials FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_testimonials_user ON testimonials(user_id);

-- Manfaat per tipe kelas (zumba/yoga/dst), ditulis instruktur, tampil sebagai
-- subtitle kolom jadwal di landing page menggantikan teks marketing statis.
CREATE TABLE IF NOT EXISTS class_type_benefits (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  benefits   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type)
);

ALTER TABLE class_type_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_type_benefits: select own" ON class_type_benefits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "class_type_benefits: insert own" ON class_type_benefits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "class_type_benefits: update own" ON class_type_benefits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "class_type_benefits: delete own" ON class_type_benefits FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_class_type_benefits_user ON class_type_benefits(user_id);

-- Bucket storage untuk foto kelas, pola sama persis seperti event-covers (migration 006)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('class-covers', 'class-covers', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "class_covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "class_covers_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "class_covers_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "class_covers_auth_delete" ON storage.objects;

CREATE POLICY "class_covers_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'class-covers');

CREATE POLICY "class_covers_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'class-covers' AND auth.role() = 'authenticated');

CREATE POLICY "class_covers_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'class-covers' AND auth.role() = 'authenticated');

CREATE POLICY "class_covers_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'class-covers' AND auth.role() = 'authenticated');
