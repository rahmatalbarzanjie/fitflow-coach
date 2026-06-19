-- ============================================================
-- Migration 026: Fix attendance + community untuk support
-- 3 sumber peserta: member, community booking, walk-in
-- ============================================================

-- 1. Ubah community_contacts: class_id → class_type
--    Komunitas sekarang per jenis kelas (Poundfit/Barre),
--    bukan per jadwal kelas tertentu
ALTER TABLE community_contacts
  ADD COLUMN IF NOT EXISTS class_type class_type;

-- Migrate data lama: ambil class_type dari kelas yang terhubung
UPDATE community_contacts cc
SET class_type = c.type
FROM classes c
WHERE cc.class_id = c.id
  AND cc.class_type IS NULL;

-- class_id tetap ada (untuk backward compat), tapi tidak wajib lagi
-- Komunitas baru cukup punya class_type tanpa harus terikat ke jadwal tertentu

-- 2. Fix tabel attendance: member_id tidak lagi wajib NOT NULL
--    Karena peserta bisa dari komunitas atau walk-in
ALTER TABLE attendance
  ALTER COLUMN member_id DROP NOT NULL;

-- 3. Tambah kolom untuk sumber peserta non-member
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS community_id  UUID REFERENCES community_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'member'
    CHECK (source IN ('member', 'booking', 'walkin')),
  ADD COLUMN IF NOT EXISTS registrant_name  TEXT,   -- untuk walk-in yang belum ada di DB
  ADD COLUMN IF NOT EXISTS registrant_phone TEXT;   -- untuk walk-in yang belum ada di DB

-- 4. Constraint: harus ada salah satu identitas peserta
--    (member, community, atau minimal nama walk-in)
ALTER TABLE attendance
  ADD CONSTRAINT attendance_has_participant CHECK (
    member_id IS NOT NULL OR
    community_id IS NOT NULL OR
    registrant_name IS NOT NULL
  );

-- 5. Update unique constraint: satu sesi tidak boleh ada duplikat per peserta
--    Hapus constraint lama (hanya member), buat yang baru
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_session_id_member_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_member_unique
  ON attendance(session_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_community_unique
  ON attendance(session_id, community_id)
  WHERE community_id IS NOT NULL;

-- 6. Index tambahan untuk performa
CREATE INDEX IF NOT EXISTS idx_attendance_community_id
  ON attendance(community_id);

CREATE INDEX IF NOT EXISTS idx_attendance_source
  ON attendance(source);

CREATE INDEX IF NOT EXISTS idx_community_contacts_class_type
  ON community_contacts(user_id, class_type);

-- 7. View: absensi lengkap per sesi (gabungan semua sumber)
CREATE OR REPLACE VIEW attendance_summary AS
SELECT
  a.id,
  a.session_id,
  a.user_id,
  a.source,
  a.payment_mode,
  a.payment_method,
  a.amount_paid,
  a.notes,
  a.created_at,
  -- Nama & HP peserta (dari sumber manapun)
  COALESCE(m.name, cc.name, a.registrant_name)   AS participant_name,
  COALESCE(m.phone, cc.phone, a.registrant_phone) AS participant_phone,
  -- Identitas sumber
  a.member_id,
  m.status AS member_status,
  a.community_id,
  cc.class_type AS community_class_type,
  -- Info sesi
  s.session_date,
  s.class_id,
  c.name  AS class_name,
  c.type  AS class_type
FROM attendance a
LEFT JOIN members           m  ON m.id  = a.member_id
LEFT JOIN community_contacts cc ON cc.id = a.community_id
JOIN  sessions              s  ON s.id  = a.session_id
JOIN  classes               c  ON c.id  = s.class_id;

-- 8. Update RLS policy attendance (tambah akses untuk community_id)
DROP POLICY IF EXISTS "attendance: select own" ON attendance;
CREATE POLICY "attendance: select own" ON attendance
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance: insert own" ON attendance;
CREATE POLICY "attendance: insert own" ON attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance: update own" ON attendance;
CREATE POLICY "attendance: update own" ON attendance
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance: delete own" ON attendance;
CREATE POLICY "attendance: delete own" ON attendance
  FOR DELETE USING (auth.uid() = user_id);

