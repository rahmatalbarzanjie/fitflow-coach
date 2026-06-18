-- Registrasi kelas sungguhan (form publik) - reuse tabel `registrations`
-- yang sebelumnya khusus event. event_id dijadikan nullable, ditambah
-- class_id + session_date (tanggal kemunculan kelas yang didaftar, bukan
-- FK ke `sessions` karena kelas berulang mingguan dan kuota harus reset
-- tiap minggu) + payment_method (enum sudah ada, sebelumnya hanya dipakai
-- di tabel attendance).

ALTER TABLE registrations
  ALTER COLUMN event_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS class_id       UUID REFERENCES classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_date   DATE,
  ADD COLUMN IF NOT EXISTS payment_method payment_method;

DO $$ BEGIN
  ALTER TABLE registrations
    ADD CONSTRAINT registrations_one_parent CHECK (
      (event_id IS NOT NULL AND class_id IS NULL) OR
      (event_id IS NULL AND class_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_registrations_class_session
  ON registrations(class_id, session_date);

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS show_registrations BOOLEAN NOT NULL DEFAULT FALSE;

-- Ringkasan registrasi kelas - mirror event_registration_summary
CREATE OR REPLACE VIEW class_registration_summary AS
SELECT
  r.id,
  r.class_id,
  r.registrant_name,
  r.registrant_phone,
  r.payment_method,
  r.amount_paid,
  r.payment_status,
  r.session_date,
  r.invited_to_join_at,
  r.joined_as_member_at,
  r.registered_at,
  r.confirmed_at,
  COALESCE(r.proof_url, '')      AS proof_url,
  r.rejection_note,
  c.name                         AS class_name,
  c.type                         AS class_type,
  (r.member_id IS NOT NULL)      AS is_member,
  (
    r.payment_status = 'confirmed'
    AND r.member_id IS NULL
    AND r.invited_to_join_at IS NULL
  )                              AS can_invite_to_join
FROM registrations r
JOIN classes c ON c.id = r.class_id;
