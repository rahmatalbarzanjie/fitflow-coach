-- OTP untuk self-service reset password lewat WhatsApp (bukan email),
-- konsisten dengan seluruh notifikasi app ini yang WA-first.
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  otp_code    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;
-- Tidak ada policy publik - hanya service role yang boleh akses (pola sama seperti system_config, migration 012)

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_profile ON password_reset_otps(profile_id);
