-- ─────────────────────────────────────────────────────────────────
-- 035_membership_foundation.sql
-- Membership Foundation: katalog paket (membership_packages) dan
-- instansi paket per member (member_memberships). Murni aditif -
-- tidak mengubah members, attendance, registrations, community_contacts,
-- atau apa pun yang sudah berjalan. Belum ada trigger attendance
-- (auto-deduction) di migration ini - itu langkah terakhir, terpisah.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS membership_packages (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  package_type   TEXT NOT NULL CHECK (package_type IN ('unlimited', 'session_pack')),
  class_type     class_type,             -- NULL = berlaku semua kelas
  total_sessions INT,                    -- wajib diisi (di level aplikasi) kalau session_pack
  duration_days  INT,                    -- masa berlaku opsional, berlaku untuk kedua tipe
  price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,  -- "hapus" paket = set false, bukan delete row
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE membership_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_packages: select own" ON membership_packages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "membership_packages: insert own" ON membership_packages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "membership_packages: update own" ON membership_packages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "membership_packages: delete own" ON membership_packages
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_membership_packages_user ON membership_packages(user_id);

-- ── Instansi paket per member ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_memberships (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- RESTRICT - paket yang sudah pernah dibeli member TIDAK BISA dihapus dari
  -- katalog, supaya histori tidak pernah rusak. "Hapus" paket di katalog =
  -- membership_packages.is_active = false (retire), bukan delete row.
  package_id     UUID NOT NULL REFERENCES membership_packages(id) ON DELETE RESTRICT,
  package_type   TEXT NOT NULL,          -- disalin dari package saat insert (hindari join di trigger attendance nanti)
  start_date     DATE NOT NULL,
  end_date       DATE,                   -- dihitung dari duration_days saat insert, disimpan eksplisit
  total_sessions INT,                    -- disalin dari package saat insert
  used_sessions  INT NOT NULL DEFAULT 0,
  purchase_price NUMERIC(10,2),          -- snapshot harga saat dibeli - histori tetap benar walau harga paket naik/turun nanti
  status         TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'completed', 'cancelled')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE member_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_memberships: select own" ON member_memberships
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "member_memberships: insert own" ON member_memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "member_memberships: update own" ON member_memberships
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "member_memberships: delete own" ON member_memberships
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_member_memberships_member      ON member_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_member_memberships_user_status ON member_memberships(user_id, status);

-- Satu member cuma boleh punya 1 membership 'active' pada satu waktu -
-- mencegah race condition (dua device assign paket bersamaan) di level DB,
-- bukan cuma dicek di aplikasi.
CREATE UNIQUE INDEX IF NOT EXISTS member_memberships_one_active_per_member
  ON member_memberships(member_id) WHERE status = 'active';
