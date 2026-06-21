-- ─────────────────────────────────────────────────────────────────
-- 034_wa_bot_foundation_patch.sql
-- WA Bot Foundation Patch: sender resolution, multi-community
-- context, dan webhook idempotency. Tidak ada logic baru di sini -
-- murni kolom/tabel pendukung untuk patch di incoming/route.ts.
-- ─────────────────────────────────────────────────────────────────

-- ── Idempotency webhook Fonnte ──────────────────────────────────────
-- Satu baris per message id dari Fonnte. Insert dicoba di awal request
-- SEBELUM proses apa pun - kalau conflict (sudah pernah diterima),
-- request dihentikan tanpa membalas lagi.
CREATE TABLE IF NOT EXISTS wa_webhook_log (
  fonnte_message_id TEXT PRIMARY KEY,
  received_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_webhook_log ENABLE ROW LEVEL SECURITY;
-- Sengaja tanpa policy - tabel operasional internal, cuma diakses
-- service-role di webhook route (bypass RLS), tidak ada akses dari
-- klien/dashboard manapun.

-- ── Sender resolution + multi-community context ─────────────────────
-- Dicatat per baris percakapan supaya histori tetap akurat soal siapa
-- yang chat dan komunitas mana, tanpa mengubah cara histori dibaca.
ALTER TABLE wa_conversations
  ADD COLUMN IF NOT EXISTS sender_kind   TEXT
    CHECK (sender_kind IN ('member', 'community_contact', 'registrant', 'unknown')),
  ADD COLUMN IF NOT EXISTS sender_ref_id UUID,
  ADD COLUMN IF NOT EXISTS class_type    class_type;

CREATE INDEX IF NOT EXISTS idx_wa_conversations_sender_kind
  ON wa_conversations(user_id, sender_kind);
