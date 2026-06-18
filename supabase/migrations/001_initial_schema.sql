-- ============================================================
-- FitFlow Coach - Initial Schema
-- Jalankan file ini di Supabase SQL Editor (sekali jalan)
-- Aman di-run ulang: semua DROP IF EXISTS ada di awal
-- ============================================================

-- ─────────────────────────────────────────
-- RESET (drop semua jika sudah ada)
-- ─────────────────────────────────────────

-- Triggers
DROP TRIGGER IF EXISTS on_auth_user_created          ON auth.users;
DROP TRIGGER IF EXISTS trigger_sync_last_attended    ON attendance;
DROP TRIGGER IF EXISTS trigger_compute_member_status ON members;

-- Functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS sync_member_last_attended();
DROP FUNCTION IF EXISTS compute_member_status();
DROP FUNCTION IF EXISTS refresh_member_statuses(UUID);
DROP FUNCTION IF EXISTS generate_sessions_for_class(UUID, INT);
DROP FUNCTION IF EXISTS confirm_registration(UUID);
DROP FUNCTION IF EXISTS invite_registrant_to_join(UUID, UUID);

-- Views
DROP VIEW IF EXISTS event_registration_summary;
DROP VIEW IF EXISTS today_sessions;
DROP VIEW IF EXISTS member_summary;

-- Tables (urutan: dependan dulu)
DROP TABLE IF EXISTS broadcast_recipients CASCADE;
DROP TABLE IF EXISTS broadcasts           CASCADE;
DROP TABLE IF EXISTS registrations        CASCADE;
DROP TABLE IF EXISTS attendance           CASCADE;
DROP TABLE IF EXISTS sessions             CASCADE;
DROP TABLE IF EXISTS classes              CASCADE;
DROP TABLE IF EXISTS events               CASCADE;
DROP TABLE IF EXISTS members              CASCADE;
DROP TABLE IF EXISTS profiles             CASCADE;

-- Enums
DROP TYPE IF EXISTS broadcast_status  CASCADE;
DROP TYPE IF EXISTS class_type        CASCADE;
DROP TYPE IF EXISTS payment_status    CASCADE;
DROP TYPE IF EXISTS registration_tier CASCADE;
DROP TYPE IF EXISTS event_status      CASCADE;
DROP TYPE IF EXISTS session_status    CASCADE;
DROP TYPE IF EXISTS payment_method    CASCADE;
DROP TYPE IF EXISTS payment_mode      CASCADE;
DROP TYPE IF EXISTS member_status     CASCADE;


-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────
CREATE TYPE member_status      AS ENUM ('new', 'active', 'at_risk', 'inactive');
CREATE TYPE payment_mode       AS ENUM ('free', 'drop_in', 'prepaid', 'debt');
CREATE TYPE payment_method     AS ENUM ('cash', 'transfer');
CREATE TYPE session_status     AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled');
CREATE TYPE event_status       AS ENUM ('draft', 'published', 'completed', 'cancelled');
CREATE TYPE registration_tier  AS ENUM ('early_bird', 'ots');
CREATE TYPE payment_status     AS ENUM ('pending', 'confirmed', 'rejected');
CREATE TYPE class_type         AS ENUM ('zumba', 'yoga', 'pilates', 'poundfit', 'aerobic', 'barre', 'other');
CREATE TYPE broadcast_status   AS ENUM ('draft', 'sent', 'scheduled');


-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

-- Profile instruktur (1 akun = 1 instruktur)
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  business_name  TEXT,
  slug           TEXT UNIQUE,  -- untuk URL publik: /{slug}/daftar/{eventSlug}
  phone          TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Member / murid kelas
CREATE TABLE members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  status           member_status NOT NULL DEFAULT 'new',
  notes            TEXT,
  last_attended_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone)
);

-- Kelas rutin (definisi jadwal)
CREATE TABLE classes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         class_type NOT NULL DEFAULT 'other',
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Minggu, 6=Sabtu
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  location     TEXT,
  capacity     INT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Sesi kelas (instance dari kelas di tanggal tertentu)
CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  status       session_status NOT NULL DEFAULT 'scheduled',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, session_date)
);

-- Presensi / kehadiran per sesi
CREATE TABLE attendance (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_mode   payment_mode NOT NULL DEFAULT 'drop_in',
  payment_method payment_method,
  amount_paid    NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, member_id)
);

-- Event / workshop khusus
CREATE TABLE events (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  slug                 TEXT NOT NULL, -- URL: /{profileSlug}/daftar/{slug}
  description          TEXT,
  event_date           DATE NOT NULL,
  start_time           TIME NOT NULL,
  end_time             TIME,
  location             TEXT,
  status               event_status NOT NULL DEFAULT 'draft',
  early_bird_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ots_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  early_bird_quota     INT,
  max_capacity         INT,
  early_bird_deadline  TIMESTAMPTZ,
  cover_image_url      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Registrasi peserta event
CREATE TABLE registrations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registrant_name     TEXT NOT NULL,
  registrant_phone    TEXT NOT NULL,
  tier                registration_tier NOT NULL DEFAULT 'ots',
  amount_paid         NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status      payment_status NOT NULL DEFAULT 'pending',
  proof_url           TEXT,
  rejection_note      TEXT,
  attended            BOOLEAN NOT NULL DEFAULT FALSE,
  member_id           UUID REFERENCES members(id) ON DELETE SET NULL,
  invited_to_join_at  TIMESTAMPTZ,
  joined_as_member_at TIMESTAMPTZ,
  registered_at       TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ
);

-- Pesan broadcast (WhatsApp / notifikasi)
CREATE TABLE broadcasts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  target_audience  TEXT NOT NULL DEFAULT 'all', -- 'all' | 'active' | 'at_risk' | 'inactive' | 'new'
  status           broadcast_status NOT NULL DEFAULT 'draft',
  recipient_count  INT DEFAULT 0,
  sent_at          TIMESTAMPTZ,
  scheduled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Penerima broadcast (per member)
CREATE TABLE broadcast_recipients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES members(id) ON DELETE SET NULL,
  phone        TEXT NOT NULL,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX idx_members_user_id        ON members(user_id);
CREATE INDEX idx_members_status         ON members(status);
CREATE INDEX idx_members_last_attended  ON members(last_attended_at);
CREATE INDEX idx_classes_user_id        ON classes(user_id);
CREATE INDEX idx_classes_active         ON classes(user_id, is_active);
CREATE INDEX idx_sessions_user_id       ON sessions(user_id);
CREATE INDEX idx_sessions_date          ON sessions(session_date);
CREATE INDEX idx_sessions_class_date    ON sessions(class_id, session_date);
CREATE INDEX idx_attendance_session     ON attendance(session_id);
CREATE INDEX idx_attendance_member      ON attendance(member_id);
CREATE INDEX idx_attendance_user        ON attendance(user_id);
CREATE INDEX idx_events_user_id         ON events(user_id);
CREATE INDEX idx_events_status          ON events(status);
CREATE INDEX idx_events_slug            ON events(user_id, slug);
CREATE INDEX idx_registrations_event    ON registrations(event_id);
CREATE INDEX idx_registrations_status   ON registrations(payment_status);
CREATE INDEX idx_broadcasts_user_id     ON broadcasts(user_id);
CREATE INDEX idx_broadcast_recipients   ON broadcast_recipients(broadcast_id);


-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profile: select own"  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profile: insert own"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profile: update own"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- members
CREATE POLICY "members: select own"  ON members FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "members: insert own"  ON members FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members: update own"  ON members FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "members: delete own"  ON members FOR DELETE  USING (auth.uid() = user_id);

-- classes
CREATE POLICY "classes: select own"  ON classes FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "classes: insert own"  ON classes FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "classes: update own"  ON classes FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "classes: delete own"  ON classes FOR DELETE  USING (auth.uid() = user_id);

-- sessions
CREATE POLICY "sessions: select own" ON sessions FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "sessions: insert own" ON sessions FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions: update own" ON sessions FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "sessions: delete own" ON sessions FOR DELETE  USING (auth.uid() = user_id);

-- attendance
CREATE POLICY "attendance: select own" ON attendance FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "attendance: insert own" ON attendance FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attendance: update own" ON attendance FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "attendance: delete own" ON attendance FOR DELETE  USING (auth.uid() = user_id);

-- events: instruktur bisa kelola semua; publik hanya bisa baca yang 'published'
CREATE POLICY "events: select published or own" ON events FOR SELECT
  USING (auth.uid() = user_id OR status = 'published');
CREATE POLICY "events: insert own"  ON events FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events: update own"  ON events FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "events: delete own"  ON events FOR DELETE  USING (auth.uid() = user_id);

-- registrations: siapapun bisa daftar (public form); instruktur kelola miliknya
CREATE POLICY "registrations: select own" ON registrations FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "registrations: insert public" ON registrations FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "registrations: update own"   ON registrations FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "registrations: delete own"   ON registrations FOR DELETE  USING (auth.uid() = user_id);

-- broadcasts
CREATE POLICY "broadcasts: select own"  ON broadcasts FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "broadcasts: insert own"  ON broadcasts FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "broadcasts: update own"  ON broadcasts FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "broadcasts: delete own"  ON broadcasts FOR DELETE  USING (auth.uid() = user_id);

-- broadcast_recipients
CREATE POLICY "bc_recipients: select own" ON broadcast_recipients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM broadcasts b WHERE b.id = broadcast_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "bc_recipients: insert own" ON broadcast_recipients FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM broadcasts b WHERE b.id = broadcast_id AND b.user_id = auth.uid()
  ));


-- ─────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────

-- Ringkasan member: total hadir, hadir bulan ini, total revenue
CREATE OR REPLACE VIEW member_summary AS
SELECT
  m.id,
  m.user_id,
  m.name,
  m.phone,
  m.status,
  m.last_attended_at,
  m.created_at,
  COUNT(a.id)::INT                                                         AS total_attended,
  COUNT(a.id) FILTER (
    WHERE DATE_TRUNC('month', a.created_at) = DATE_TRUNC('month', NOW())
  )::INT                                                                    AS attended_this_month,
  COALESCE(SUM(a.amount_paid), 0)                                           AS total_revenue
FROM members m
LEFT JOIN attendance a ON a.member_id = m.id
GROUP BY m.id, m.user_id, m.name, m.phone, m.status, m.last_attended_at, m.created_at;

-- Sesi hari ini: gabung dengan class info + jumlah hadir + revenue
CREATE OR REPLACE VIEW today_sessions AS
SELECT
  s.id              AS session_id,
  s.class_id,
  s.session_date,
  s.start_time,
  s.end_time,
  s.status,
  c.name            AS class_name,
  c.type            AS class_type,
  c.location,
  c.user_id,
  c.capacity,
  COUNT(a.id)::INT                          AS attended_count,
  COALESCE(SUM(a.amount_paid), 0)           AS session_revenue
FROM sessions s
JOIN  classes   c ON c.id = s.class_id
LEFT JOIN attendance a ON a.session_id = s.id
GROUP BY s.id, s.class_id, s.session_date, s.start_time, s.end_time,
         s.status, c.name, c.type, c.location, c.user_id, c.capacity;

-- Ringkasan registrasi event
CREATE OR REPLACE VIEW event_registration_summary AS
SELECT
  r.id,
  r.event_id,
  r.registrant_name,
  r.registrant_phone,
  r.tier,
  r.amount_paid,
  r.payment_status,
  r.attended,
  r.invited_to_join_at,
  r.joined_as_member_at,
  r.registered_at,
  r.confirmed_at,
  COALESCE(r.proof_url, '')      AS proof_url,
  r.rejection_note,
  e.title                        AS event_title,
  e.event_date,
  (r.member_id IS NOT NULL)      AS is_member,
  (
    r.payment_status = 'confirmed'
    AND r.member_id IS NULL
    AND r.invited_to_join_at IS NULL
  )                              AS can_invite_to_join
FROM registrations r
JOIN events e ON e.id = r.event_id;


-- ─────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────

-- 1. Auto-create profile saat user baru signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_name TEXT;
  base_slug TEXT;
BEGIN
  base_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );
  base_slug := LOWER(REGEXP_REPLACE(base_name, '[^a-zA-Z0-9]', '-', 'g'))
               || '-' || SUBSTRING(NEW.id::TEXT, 1, 6);

  INSERT INTO profiles (id, name, slug)
  VALUES (NEW.id, base_name, base_slug)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Update last_attended_at member setelah presensi ditambah/dihapus
CREATE OR REPLACE FUNCTION sync_member_last_attended()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_member_id UUID;
BEGIN
  target_member_id := COALESCE(NEW.member_id, OLD.member_id);

  UPDATE members
  SET
    last_attended_at = (
      SELECT MAX(s.session_date)::TIMESTAMPTZ
      FROM attendance a
      JOIN sessions s ON s.id = a.session_id
      WHERE a.member_id = target_member_id
    ),
    updated_at = NOW()
  WHERE id = target_member_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER trigger_sync_last_attended
  AFTER INSERT OR DELETE ON attendance
  FOR EACH ROW EXECUTE FUNCTION sync_member_last_attended();

-- 3. Auto-update status member berdasarkan last_attended_at
CREATE OR REPLACE FUNCTION compute_member_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  days_since INT;
BEGIN
  IF NEW.last_attended_at IS NULL THEN
    NEW.status := CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400 <= 7
        THEN 'new'::member_status
      ELSE 'inactive'::member_status
    END;
  ELSE
    days_since := EXTRACT(EPOCH FROM (NOW() - NEW.last_attended_at)) / 86400;
    NEW.status := CASE
      WHEN days_since <= 14 THEN 'active'::member_status
      WHEN days_since <= 30 THEN 'at_risk'::member_status
      ELSE 'inactive'::member_status
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_compute_member_status
  BEFORE UPDATE OF last_attended_at ON members
  FOR EACH ROW EXECUTE FUNCTION compute_member_status();

-- 4. Batch refresh status semua member (dipanggil dari Node-RED cron harian)
CREATE OR REPLACE FUNCTION refresh_member_statuses(p_user_id UUID DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE members
  SET
    status = CASE
      WHEN last_attended_at IS NULL AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 <= 7
        THEN 'new'::member_status
      WHEN last_attended_at IS NULL
        THEN 'inactive'::member_status
      WHEN EXTRACT(EPOCH FROM (NOW() - last_attended_at)) / 86400 <= 14
        THEN 'active'::member_status
      WHEN EXTRACT(EPOCH FROM (NOW() - last_attended_at)) / 86400 <= 30
        THEN 'at_risk'::member_status
      ELSE 'inactive'::member_status
    END,
    updated_at = NOW()
  WHERE (p_user_id IS NULL OR user_id = p_user_id);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 5. Helper: generate sesi kelas untuk N hari ke depan
CREATE OR REPLACE FUNCTION generate_sessions_for_class(
  p_class_id UUID,
  p_days_ahead INT DEFAULT 28
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cls          RECORD;
  check_date   DATE;
  end_date     DATE;
  inserted     INT := 0;
BEGIN
  SELECT * INTO cls FROM classes WHERE id = p_class_id;
  IF NOT FOUND OR NOT cls.is_active THEN RETURN 0; END IF;

  check_date := CURRENT_DATE;
  end_date   := CURRENT_DATE + p_days_ahead;

  WHILE check_date <= end_date LOOP
    IF EXTRACT(DOW FROM check_date)::INT = cls.day_of_week THEN
      INSERT INTO sessions (class_id, user_id, session_date, start_time, end_time)
      VALUES (cls.id, cls.user_id, check_date, cls.start_time, cls.end_time)
      ON CONFLICT (class_id, session_date) DO NOTHING;

      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;
    check_date := check_date + 1;
  END LOOP;

  RETURN inserted;
END;
$$;

-- 6. Konfirmasi registrasi event dan set timestamp
CREATE OR REPLACE FUNCTION confirm_registration(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE registrations
  SET
    payment_status = 'confirmed',
    confirmed_at   = NOW()
  WHERE id = p_registration_id
    AND user_id = auth.uid();
END;
$$;

-- 7. Invite registrant menjadi member kelas reguler
CREATE OR REPLACE FUNCTION invite_registrant_to_join(
  p_registration_id UUID,
  p_member_id       UUID DEFAULT NULL  -- jika sudah ada member, link ke sana
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE registrations
  SET
    invited_to_join_at = NOW(),
    member_id          = p_member_id
  WHERE id = p_registration_id
    AND user_id = auth.uid()
    AND payment_status = 'confirmed';
END;
$$;


-- ─────────────────────────────────────────
-- STORAGE BUCKETS (jalankan manual di Storage UI atau uncomment)
-- ─────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers',   'event-covers',   true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars',        'avatars',        true);


-- ─────────────────────────────────────────
-- SELESAI
-- ─────────────────────────────────────────
-- Setelah run ini, generate TypeScript types:
-- npx supabase gen types typescript --project-id vulxebisavfiokybufmr --schema public > src/types/database.ts
