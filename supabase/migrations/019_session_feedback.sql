-- Tracking siapa diundang & sudah pakai jatahnya — TIDAK terhubung ke isi
-- feedback, hanya untuk kirim WA & cegah double-submit per attendee per sesi.
CREATE TABLE IF NOT EXISTS feedback_invites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  phone      TEXT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, member_id)
);

ALTER TABLE feedback_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_invites: select own" ON feedback_invites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "feedback_invites: insert own" ON feedback_invites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feedback_invites: update own" ON feedback_invites FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_invites_session ON feedback_invites(session_id);

-- Isi feedback — SENGAJA tidak ada member_id/nama sama sekali, demi anonimitas penuh.
CREATE TABLE IF NOT EXISTS session_feedback (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;

-- Hanya select own (instruktur baca) — tidak ada policy insert publik,
-- insert dilakukan lewat API route dengan service client saja.
CREATE POLICY "session_feedback: select own" ON session_feedback FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_session_feedback_session ON session_feedback(session_id);
