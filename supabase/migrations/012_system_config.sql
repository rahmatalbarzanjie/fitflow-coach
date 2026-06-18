-- System configuration table
-- Stores app-level settings that admins can change via the UI instead of editing .env files

CREATE TABLE IF NOT EXISTS system_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
-- No public RLS policies - only service role key can access

INSERT INTO system_config (key, value, description) VALUES
  ('fonnte_token', '', 'Token API Fonnte untuk kirim WhatsApp. Dapatkan di fonnte.com'),
  ('admin_wa',     '', 'Nomor WhatsApp admin untuk support (format: 628xxx)'),
  ('app_name',     'FitFlow Coach', 'Nama aplikasi yang ditampilkan ke pengguna'),
  ('app_url',      '', 'URL publik aplikasi (misal: https://fitflow.id)')
ON CONFLICT (key) DO NOTHING;
