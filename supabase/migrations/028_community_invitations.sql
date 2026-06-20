-- ─────────────────────────────────────────────────────────────────
-- 028_community_invitations.sql
-- Tabel untuk tracking undangan komunitas per peserta per class_type
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_invitation_candidates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identitas peserta (bisa dari member, walk-in, atau booking)
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  class_type      TEXT NOT NULL,   -- 'barre' | 'poundfit' | 'yoga' | dst

  -- Sumber data
  source_type     TEXT NOT NULL,   -- 'class_attendance' | 'event_registration'
  source_id       UUID,            -- session_id atau event_id

  attendance_date DATE NOT NULL,

  -- Status undangan
  status          TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'invited' | 'joined' | 'dismissed'

  invited_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Satu nomor HP per class_type per instruktur = satu kandidat
  -- Peserta bisa masuk ke komunitas Barre DAN Poundfit secara bersamaan
  UNIQUE(user_id, phone, class_type)
);

ALTER TABLE community_invitation_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_invitation_candidates: select own"
  ON community_invitation_candidates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "community_invitation_candidates: insert own"
  ON community_invitation_candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_invitation_candidates: update own"
  ON community_invitation_candidates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "community_invitation_candidates: delete own"
  ON community_invitation_candidates FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comm_inv_user_id
  ON community_invitation_candidates(user_id);

CREATE INDEX IF NOT EXISTS idx_comm_inv_status
  ON community_invitation_candidates(user_id, status);

CREATE INDEX IF NOT EXISTS idx_comm_inv_phone_type
  ON community_invitation_candidates(user_id, phone, class_type);
