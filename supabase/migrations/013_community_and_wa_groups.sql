-- Nomor bot WhatsApp (Fonnte) per instruktur — terpisah dari profiles.phone
-- yang tetap berarti nomor pribadi/kontak instruktur. Nomor bot ini yang
-- dipakai untuk broadcast, auto-reply AI, dan post ke grup komunitas.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bot_phone    TEXT,
  ADD COLUMN IF NOT EXISTS fonnte_token TEXT;

-- Grup WA komunitas yang terhubung ke sebuah kelas (mis. "Poundfit Senin" -> grup WA Poundfit)
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS wa_group_id   TEXT,
  ADD COLUMN IF NOT EXISTS wa_group_name TEXT;

-- Orang yang ikut grup/komunitas instruktur tapi belum tentu Member berbayar.
-- Dipisah dari tabel `members` supaya headcount komunitas tidak campur
-- dengan Member yang benar-benar terdaftar & bayar.
CREATE TABLE IF NOT EXISTS community_contacts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id             UUID REFERENCES classes(id) ON DELETE SET NULL,
  name                 TEXT,
  phone                TEXT,
  notes                TEXT,
  source               TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'wa_group'
  converted_member_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_contacts: select own" ON community_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "community_contacts: insert own" ON community_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_contacts: update own" ON community_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "community_contacts: delete own" ON community_contacts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_community_contacts_user_id  ON community_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_contacts_class_id ON community_contacts(class_id);

-- Broadcast bisa opsional juga sekali post ke grup WA komunitas suatu kelas,
-- terpisah dan independen dari kirim personal ke Member.
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_sent_at   TIMESTAMPTZ;
