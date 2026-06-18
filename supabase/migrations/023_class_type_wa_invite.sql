-- Link invite WA group per tipe kelas/olahraga — diisi manual oleh
-- instruktur (WhatsApp tidak punya API untuk generate link invite),
-- dipakai di landing page supaya orang bisa join grup komunitas yang
-- sesuai olahraganya langsung tanpa lewat bot AI.
ALTER TABLE class_type_benefits
  ADD COLUMN IF NOT EXISTS wa_invite_link TEXT;
