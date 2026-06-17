-- Rating bintang + link testimoni per member (1 jatah submit per member)
ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS rating    SMALLINT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- 1 testimoni per member — NULL tetap boleh banyak (testimoni manual non-member yang instruktur tulis sendiri)
CREATE UNIQUE INDEX IF NOT EXISTS idx_testimonials_member_unique
  ON testimonials(member_id) WHERE member_id IS NOT NULL;
