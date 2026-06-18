-- Tandai profil developer/platform admin — beda dari instruktur biasa.
-- Bot WA developer (device terpisah, bukan device instruktur manapun)
-- dapat akses laporan lintas-instruktur (list instruktur, ranking member/
-- kelas, status langganan) saat kolom ini true.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;
