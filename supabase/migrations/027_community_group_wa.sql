-- ============================================================
-- Migration 027: Tambah wa_group_id ke class_type_benefits
-- untuk auto-capture member dari grup komunitas WA (Level 1)
-- ============================================================

-- Tambah wa_group_id ke class_type_benefits
-- Format: "xxx@g.us" (ID grup dari Fonnte)
ALTER TABLE class_type_benefits
  ADD COLUMN IF NOT EXISTS wa_group_id TEXT;

-- Index untuk lookup cepat saat webhook incoming
-- (cari instruktur berdasarkan group ID yang kirim pesan)
CREATE INDEX IF NOT EXISTS idx_class_type_benefits_wa_group
  ON class_type_benefits(wa_group_id)
  WHERE wa_group_id IS NOT NULL;

-- Index untuk lookup community_contacts by phone
-- (cek duplikat saat auto-insert dari grup WA)
CREATE INDEX IF NOT EXISTS idx_community_contacts_phone
  ON community_contacts(user_id, phone)
  WHERE phone IS NOT NULL;
