-- Migration 008: Add session change management columns to class_sessions
ALTER TABLE class_sessions
ADD COLUMN IF NOT EXISTS session_type varchar(20) DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS original_date date,
ADD COLUMN IF NOT EXISTS original_time time,
ADD COLUMN IF NOT EXISTS change_reason text,
ADD COLUMN IF NOT EXISTS notified_at timestamptz,
ADD COLUMN IF NOT EXISTS override_location varchar(255);

COMMENT ON COLUMN class_sessions.session_type IS
  'regular | extra | rescheduled | location_changed';
COMMENT ON COLUMN class_sessions.override_location IS
  'Lokasi pengganti untuk sesi ini saja, NULL = pakai lokasi kelas';
