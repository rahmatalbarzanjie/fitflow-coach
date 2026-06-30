-- ============================================================
-- Migration 080: Slug untuk classes
-- Link pendaftaran kelas (WA bot + landing page) selama ini pakai
-- UUID mentah (panjang, tidak rapi di chat WhatsApp). Tambah slug
-- auto-generate dari nama kelas, sama konsepnya dengan slug profil
-- instruktur - read-only, tidak perlu field form baru, selalu
-- sinkron otomatis kalau nama kelas diubah.
-- ============================================================

ALTER TABLE classes ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE OR REPLACE FUNCTION generate_class_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  suffix INT := 1;
BEGIN
  -- Skip kalau ini cuma backfill/update kolom lain - nama tidak berubah
  -- dan slug sudah ada, tidak perlu generate ulang.
  IF TG_OP = 'UPDATE' AND NEW.name = OLD.name AND NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base_slug := TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(TRIM(NEW.name), '[^a-zA-Z0-9]+', '-', 'g')));
  IF base_slug = '' THEN
    base_slug := 'kelas';
  END IF;
  candidate := base_slug;

  WHILE EXISTS (
    SELECT 1 FROM classes
    WHERE user_id = NEW.user_id AND slug = candidate AND id IS DISTINCT FROM NEW.id
  ) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_generate_class_slug
  BEFORE INSERT OR UPDATE OF name ON classes
  FOR EACH ROW EXECUTE FUNCTION generate_class_slug();

-- Backfill kelas yang sudah ada (trigger di atas hanya jalan untuk
-- INSERT/UPDATE OF name - "SET name = name" tetap memicu trigger
-- BEFORE UPDATE OF name di Postgres meskipun nilainya sama).
-- Diproses satu baris per statement (bukan satu UPDATE massal) supaya
-- pengecekan uniqueness di trigger melihat slug yang baru saja dibuat
-- baris-baris sebelumnya - mencegah 2 kelas bernama sama persis dalam
-- satu instruktur dapat slug yang sama.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM classes WHERE slug IS NULL LOOP
    UPDATE classes SET name = name WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE classes ALTER COLUMN slug SET NOT NULL;
ALTER TABLE classes ADD CONSTRAINT classes_user_id_slug_key UNIQUE (user_id, slug);
