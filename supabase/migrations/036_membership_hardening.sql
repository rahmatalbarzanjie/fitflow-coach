-- ─────────────────────────────────────────────────────────────────
-- 036_membership_hardening.sql
-- Pengerasan desain Membership Foundation sebelum Sprint 2 mulai
-- menulis ke member_memberships:
--   1. RLS cross-tenant - INSERT/UPDATE wajib validasi member_id dan
--      package_id benar-benar milik instruktur yang sama (bukan cuma
--      baris member_memberships itu sendiri).
--   2. package_name - snapshot nama paket saat dibeli, immutable
--      walau nama di katalog (membership_packages) diubah belakangan.
--      NOT NULL dari awal (tabel masih kosong, aman) supaya tidak ada
--      histori campuran null/terisi.
--   3. status 'pending' - dukung renewal tanpa harus cancel paket
--      yang masih aktif (lihat desain: 1 active, N pending, tanpa
--      UNIQUE pending - pending tidak menyentuh attendance/kuota/
--      billing aktif jadi aman dibiarkan lebih dari satu).
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Snapshot nama paket ───────────────────────────────────────────
ALTER TABLE member_memberships
  ADD COLUMN IF NOT EXISTS package_name TEXT NOT NULL DEFAULT '';

-- DEFAULT '' di atas cuma syarat sintaks Postgres untuk ADD COLUMN NOT
-- NULL - tabel ini kosong (belum ada Assign Package di Sprint 2), jadi
-- tidak ada baris lama yang kebagian nilai '' secara nyata. Hapus
-- default-nya supaya insert berikutnya WAJIB isi eksplisit, tidak bisa
-- diam-diam kosong.
ALTER TABLE member_memberships
  ALTER COLUMN package_name DROP DEFAULT;

-- ── 2. Tambah status 'pending' ────────────────────────────────────────
ALTER TABLE member_memberships
  DROP CONSTRAINT IF EXISTS member_memberships_status_check;

ALTER TABLE member_memberships
  ADD CONSTRAINT member_memberships_status_check
    CHECK (status IN ('active', 'pending', 'expired', 'completed', 'cancelled'));

-- Catatan desain (tidak ada SQL untuk ini, murni dokumentasi): SENGAJA
-- tidak ada UNIQUE INDEX ... WHERE status = 'pending'. Satu member boleh
-- punya banyak baris pending (antrian paket beberapa bulan ke depan) -
-- yang dibatasi cuma status 'active' (lihat index yang sudah ada di
-- migration 035, tidak diubah di sini).

-- ── 3. RLS cross-tenant - perketat INSERT & UPDATE ───────────────────
-- Kebijakan lama cuma cek auth.uid() = user_id pada baris itu sendiri -
-- tidak memvalidasi member_id/package_id yang dirujuk benar-benar milik
-- instruktur yang sama. UI yang benar tidak akan pernah mengirim
-- kombinasi salah (SELECT RLS di members/membership_packages sudah
-- menyaring data lintas-tenant dari dropdown), tapi endpoint tidak boleh
-- bergantung pada itu - data ini menyangkut kuota sesi dan uang.
DROP POLICY IF EXISTS "member_memberships: insert own" ON member_memberships;
CREATE POLICY "member_memberships: insert own" ON member_memberships
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM members m WHERE m.id = member_id AND m.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM membership_packages p WHERE p.id = package_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "member_memberships: update own" ON member_memberships;
CREATE POLICY "member_memberships: update own" ON member_memberships
  FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM members m WHERE m.id = member_id AND m.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM membership_packages p WHERE p.id = package_id AND p.user_id = auth.uid())
  );
