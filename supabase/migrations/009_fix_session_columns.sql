-- Migration 009: Fix session change columns (migration 008 used wrong table name)
-- The actual table is 'sessions', not 'class_sessions'

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS session_type varchar(20) NOT NULL DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS original_date date,
ADD COLUMN IF NOT EXISTS original_time time,
ADD COLUMN IF NOT EXISTS change_reason text,
ADD COLUMN IF NOT EXISTS notified_at timestamptz,
ADD COLUMN IF NOT EXISTS override_location varchar(255);

COMMENT ON COLUMN sessions.session_type IS
  'regular | extra | rescheduled | location_changed';
COMMENT ON COLUMN sessions.override_location IS
  'Lokasi pengganti untuk sesi ini saja, NULL = pakai lokasi kelas';
