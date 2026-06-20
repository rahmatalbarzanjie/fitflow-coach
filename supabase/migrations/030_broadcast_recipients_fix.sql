-- ============================================================
-- Migration 030: broadcast_recipients jadi sumber kebenaran
-- untuk status kirim per-penerima (sebelumnya tabel ini ada
-- tapi tidak pernah dipakai oleh kode).
-- ============================================================

-- Kolom error per-penerima (kenapa gagal, kalau gagal)
ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS error TEXT;

-- Satu broadcast tidak boleh punya 2 row untuk member yang sama -
-- ini yang membuat retry bisa "upsert" dengan aman tanpa duplikat.
-- NULL member_id (kalau member dihapus) tetap boleh banyak, itu
-- perilaku default unique index di Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS broadcast_recipients_broadcast_member_unique
  ON broadcast_recipients(broadcast_id, member_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_id
  ON broadcast_recipients(broadcast_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status
  ON broadcast_recipients(broadcast_id, status);

-- RLS sebelumnya hanya punya policy SELECT + INSERT - tidak ada UPDATE.
-- Tanpa ini, update status 'sent'/'failed' per-penerima akan gagal diam-diam
-- (RLS block, 0 rows affected, tidak ada error yang dilempar).
CREATE POLICY "bc_recipients: update own" ON broadcast_recipients FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM broadcasts b WHERE b.id = broadcast_id AND b.user_id = auth.uid()
  ));
