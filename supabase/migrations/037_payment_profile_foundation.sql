-- ─────────────────────────────────────────────────────────────────
-- 037_payment_profile_foundation.sql
-- Payment Profile Foundation: entitas mandiri "tujuan pembayaran"
-- (BUKAN metode pembayaran) milik instruktur, dengan banyak Payment
-- Method (bank/qris) di dalamnya. Class/Event/Membership Package
-- memilih satu Payment Profile masing-masing - registrations dan
-- member_memberships TIDAK punya kolom sendiri, mewarisi dari induknya.
--
-- Murni aditif - tidak ada kolom/tabel lama yang diubah atau dihapus.
-- events.bank_name/bank_account_* TETAP ADA (jaring pengaman rollback),
-- cuma tidak dipakai lagi oleh form/tampilan baru.
-- ─────────────────────────────────────────────────────────────────

-- ── Payment Profile (tujuan pembayaran) ──────────────────────────────
CREATE TABLE IF NOT EXISTS payment_profiles (
  id         UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,           -- "Nana Personal" / "Keyra Studio"
  is_active  BOOLEAN NOT NULL DEFAULT true,  -- retire (≠ delete) - hilang dari
                                              -- picker baru, tapi tetap berlaku
                                              -- untuk kelas/event yang sudah pakai
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_profiles: select own" ON payment_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payment_profiles: insert own" ON payment_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payment_profiles: update own" ON payment_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "payment_profiles: delete own" ON payment_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_profiles_user ON payment_profiles(user_id);

-- ── Payment Method (rail - banyak per Payment Profile) ───────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id                  UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized, pola sama class_gallery/event_gallery
  payment_profile_id  UUID NOT NULL REFERENCES payment_profiles(id) ON DELETE CASCADE,
  method_type         TEXT NOT NULL CHECK (method_type IN ('bank', 'qris')),
  bank_name           TEXT,
  account_number      TEXT,
  account_name        TEXT,
  qris_image_url      TEXT,           -- QRIS statis (gambar) - tidak ada payload/dinamis, lihat audit
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods: select own" ON payment_methods
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE diperkeras dengan cross-tenant check (pola sama
-- member_memberships, migration 036) - bukan cuma cek baris ini sendiri,
-- tapi pastikan payment_profile_id yang dirujuk juga milik user yang sama.
CREATE POLICY "payment_methods: insert own" ON payment_methods
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM payment_profiles p WHERE p.id = payment_profile_id AND p.user_id = auth.uid())
  );
CREATE POLICY "payment_methods: update own" ON payment_methods
  FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM payment_profiles p WHERE p.id = payment_profile_id AND p.user_id = auth.uid())
  );
CREATE POLICY "payment_methods: delete own" ON payment_methods
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_profile ON payment_methods(payment_profile_id, sort_order);

-- ── Class / Event / Membership Package memilih Payment Profile ───────
-- ON DELETE RESTRICT - profile yang masih direferensikan TIDAK BISA
-- dihapus (cuma bisa di-retire via is_active=false). Nullable - opsional,
-- tidak memaksa migrasi data retroaktif.
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS payment_profile_id UUID REFERENCES payment_profiles(id) ON DELETE RESTRICT;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS payment_profile_id UUID REFERENCES payment_profiles(id) ON DELETE RESTRICT;

ALTER TABLE membership_packages
  ADD COLUMN IF NOT EXISTS payment_profile_id UUID REFERENCES payment_profiles(id) ON DELETE RESTRICT;

-- Cross-tenant hardening untuk UPDATE classes/events/membership_packages
-- saat payment_profile_id diisi/diubah - sama prinsipnya dengan
-- payment_methods di atas (RLS lama cuma cek user_id baris itu sendiri,
-- tidak cross-check kepemilikan profile yang dirujuk).
DROP POLICY IF EXISTS "classes: update own" ON classes;
CREATE POLICY "classes: update own" ON classes
  FOR UPDATE USING (
    auth.uid() = user_id
    AND (payment_profile_id IS NULL OR EXISTS (
      SELECT 1 FROM payment_profiles p WHERE p.id = payment_profile_id AND p.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "events: update own" ON events;
CREATE POLICY "events: update own" ON events
  FOR UPDATE USING (
    auth.uid() = user_id
    AND (payment_profile_id IS NULL OR EXISTS (
      SELECT 1 FROM payment_profiles p WHERE p.id = payment_profile_id AND p.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "membership_packages: update own" ON membership_packages;
CREATE POLICY "membership_packages: update own" ON membership_packages
  FOR UPDATE USING (
    auth.uid() = user_id
    AND (payment_profile_id IS NULL OR EXISTS (
      SELECT 1 FROM payment_profiles p WHERE p.id = payment_profile_id AND p.user_id = auth.uid()
    ))
  );

-- ── Storage bucket untuk QRIS (gambar statis, pola sama class-gallery) ─
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-qris', 'payment-qris', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment_qris_public_read" ON storage.objects;
DROP POLICY IF EXISTS "payment_qris_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "payment_qris_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "payment_qris_auth_delete" ON storage.objects;

CREATE POLICY "payment_qris_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-qris');
CREATE POLICY "payment_qris_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-qris' AND auth.role() = 'authenticated');
CREATE POLICY "payment_qris_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'payment-qris' AND auth.role() = 'authenticated');
CREATE POLICY "payment_qris_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'payment-qris' AND auth.role() = 'authenticated');
