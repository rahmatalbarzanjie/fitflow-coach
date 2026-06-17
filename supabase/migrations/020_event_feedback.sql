-- Perluas feedback_invites/session_feedback (dibuat di migration 019 untuk
-- kelas) supaya bisa juga dipakai untuk Event — tabel tidak di-rename,
-- cukup ditambah kolom event_id/registration_id (nullable, salah satu jalur
-- session_id+member_id ATAU event_id+registration_id yang terisi).
ALTER TABLE feedback_invites
  ALTER COLUMN session_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE feedback_invites
    ADD CONSTRAINT feedback_invites_event_registration_unique UNIQUE(event_id, registration_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE session_feedback
  ALTER COLUMN session_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
