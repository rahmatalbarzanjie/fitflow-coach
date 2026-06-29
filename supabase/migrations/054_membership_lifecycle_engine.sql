-- ─────────────────────────────────────────────────────────────────
-- 054_membership_lifecycle_engine.sql
-- Implementasi Membership Lifecycle Engine - lihat
-- docs/MEMBERSHIP_LIFECYCLE_ENGINE_DESIGN.md untuk desain lengkap +
-- alasan setiap keputusan. Ringkas:
--
-- 1. `source` ('fitflow'|'legacy') pada member_memberships - satu-
--    satunya saklar yang menentukan apakah purchase_price masuk
--    hitungan revenue. Tidak ada flag terpisah yang bisa lupa di-set -
--    source 'legacy' = tidak masuk revenue, titik.
-- 2. `used_sessions` DIHAPUS dari member_memberships - kolom ini tidak
--    pernah di-update oleh kode/trigger apa pun sejak awal (selalu 0).
--    Diganti dengan membership_consumptions (ledger append-only),
--    remaining session SELALU dihitung, tidak pernah disimpan.
-- 3. Titik pemotongan sesi HANYA attendance (kehadiran nyata) - bukan
--    registrations/booking. Trigger di tabel attendance, bukan di
--    registrations.
-- 4. RPC create_legacy_membership - migrasi member lama (kasus CAREA),
--    insert membership + N entri konsumsi backdated dalam satu
--    transaksi atomic.
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Source flag ───────────────────────────────────────────────────
ALTER TABLE member_memberships
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'fitflow'
  CHECK (source IN ('fitflow', 'legacy'));

-- ── 2. Hapus used_sessions - tidak pernah benar, diganti ledger ──────
ALTER TABLE member_memberships DROP COLUMN IF EXISTS used_sessions;

-- ── 3. Consumption Ledger ────────────────────────────────────────────
CREATE TABLE membership_consumptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id   UUID NOT NULL REFERENCES member_memberships(id) ON DELETE CASCADE,
  -- Nullable - entri migrasi legacy tidak terhubung ke attendance nyata
  -- (kehadirannya terjadi sebelum FitFlow dipakai). SET NULL (bukan
  -- CASCADE) kalau attendance-nya suatu saat dihapus permanen - ledger
  -- tetap jadi fakta historis "sesi ini pernah terpakai", attendance_id
  -- yang hilang referensinya, bukan baris ledgernya.
  attendance_id   UUID REFERENCES attendance(id) ON DELETE SET NULL,
  note            TEXT,
  -- Append-only: pembatalan/koreksi = isi reversed_at, JANGAN DELETE.
  reversed_at     TIMESTAMPTZ,
  reversed_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_membership_consumptions_membership
  ON membership_consumptions(membership_id) WHERE reversed_at IS NULL;
CREATE INDEX idx_membership_consumptions_attendance
  ON membership_consumptions(attendance_id);

ALTER TABLE membership_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_consumptions: select own" ON membership_consumptions
  FOR SELECT USING (auth.uid() = user_id);
-- Sengaja TIDAK ada policy INSERT/UPDATE/DELETE untuk klien - semua
-- mutasi lewat trigger di bawah (SECURITY DEFINER, bypass RLS secara
-- internal) atau RPC create_legacy_membership. Ledger tidak boleh
-- dimanipulasi langsung dari browser.

-- ── 4. Trigger: attendance ↔ consumption ─────────────────────────────
-- AFTER INSERT: cari membership session_pack aktif yang eligible
-- (package.class_type NULL = semua kelas, atau cocok tipe kelas yang
-- dihadiri), buat 1 entri konsumsi. Member tanpa membership aktif yang
-- cocok (walk-in, komunitas, atau memang tidak punya paket) - tidak
-- terjadi apa pun, attendance tetap tercatat seperti biasa.
--
-- AFTER DELETE: balik entri konsumsi terkait (reversed_at), JANGAN
-- hapus baris ledger - audit trail tetap ada "sesi ini pernah
-- terpakai, lalu dibatalkan".
CREATE OR REPLACE FUNCTION sync_membership_consumption()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_membership_id UUID;
  v_class_type    class_type;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE membership_consumptions
    SET reversed_at = NOW(), reversed_reason = 'attendance_deleted'
    WHERE attendance_id = OLD.id AND reversed_at IS NULL;
    RETURN OLD;
  END IF;

  -- TG_OP = 'INSERT'
  IF NEW.member_id IS NULL THEN
    RETURN NEW; -- walk-in/komunitas, bukan member - tidak ada paket untuk dikonsumsi
  END IF;

  SELECT c.type INTO v_class_type
  FROM sessions s JOIN classes c ON c.id = s.class_id
  WHERE s.id = NEW.session_id;

  SELECT mm.id INTO v_membership_id
  FROM member_memberships mm
  JOIN membership_packages mp ON mp.id = mm.package_id
  WHERE mm.member_id = NEW.member_id
    AND mm.status = 'active'
    AND mm.package_type = 'session_pack'
    AND (mp.class_type IS NULL OR mp.class_type = v_class_type)
  LIMIT 1;

  IF v_membership_id IS NOT NULL THEN
    INSERT INTO membership_consumptions (user_id, membership_id, attendance_id)
    VALUES (NEW.user_id, v_membership_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_sync_membership_consumption
  AFTER INSERT OR DELETE ON attendance
  FOR EACH ROW EXECUTE FUNCTION sync_membership_consumption();

-- ── 5. RPC: migrasi member lama (kasus CAREA) ────────────────────────
-- Insert membership (source='legacy', tidak masuk revenue) + N entri
-- konsumsi backdated mewakili sesi yang sudah terpakai sebelum migrasi
-- - dalam satu transaksi atomic (gagal sebagian = gagal semua, tidak
-- ada membership "yatim" tanpa konsumsi yang seharusnya ada).
--
-- Khusus session_pack - package unlimited tidak punya konsep sisa
-- sesi, pakai AssignPackageForm biasa dengan source='legacy' kalau
-- perlu migrasi member unlimited lama.
CREATE OR REPLACE FUNCTION create_legacy_membership(
  p_member_id      UUID,
  p_package_id     UUID,
  p_total_sessions INT,
  p_used_sessions  INT,
  p_purchase_price NUMERIC,
  p_start_date     DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_package       RECORD;
  v_membership_id UUID;
  i               INT;
BEGIN
  IF p_total_sessions IS NULL OR p_total_sessions <= 0 THEN
    RAISE EXCEPTION 'invalid_total_sessions';
  END IF;
  IF p_used_sessions IS NULL OR p_used_sessions < 0 OR p_used_sessions > p_total_sessions THEN
    RAISE EXCEPTION 'invalid_used_sessions';
  END IF;

  SELECT * INTO v_package FROM membership_packages
  WHERE id = p_package_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;
  IF v_package.package_type != 'session_pack' THEN
    RAISE EXCEPTION 'legacy_migration_only_for_session_pack';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM members WHERE id = p_member_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  INSERT INTO member_memberships (
    user_id, member_id, package_id, package_name, package_type,
    start_date, total_sessions, purchase_price, status, source
  )
  VALUES (
    auth.uid(), p_member_id, p_package_id, v_package.name, v_package.package_type,
    p_start_date, p_total_sessions, p_purchase_price, 'active', 'legacy'
  )
  RETURNING id INTO v_membership_id;

  FOR i IN 1..p_used_sessions LOOP
    INSERT INTO membership_consumptions (user_id, membership_id, attendance_id, note)
    VALUES (auth.uid(), v_membership_id, NULL, 'Migrasi data lama - tidak terhubung ke sesi spesifik');
  END LOOP;

  RETURN v_membership_id;
END;
$$;
