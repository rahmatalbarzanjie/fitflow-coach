-- ─────────────────────────────────────────────────────────────────
-- 057_membership_exhaustion_promotion.sql
-- Gap ditemukan saat review sebelum merge (bukan asumsi - dikonfirmasi
-- langsung ke kode): trigger konsumsi (054/056) tidak cek sisa sesi
-- sebelum mengonsumsi, dan TIDAK ADA kode mana pun (termasuk
-- CancelMembershipButton) yang mempromosikan membership 'pending' ke
-- 'active' saat yang 'active' habis/dibatalkan. Member yang sudah BELI
-- paket berikutnya bisa nyangkut di antrian selamanya.
--
-- Constraint lama (migration 035) sudah memutuskan secara struktural:
-- cuma 1 membership 'active' per member ('member_memberships_one_
-- active_per_member' UNIQUE INDEX) - jadi "dua membership aktif
-- bersamaan" TIDAK PERNAH mungkin terjadi, titik. Yang hilang murni
-- bagian "antrian-nya jalan otomatis", bukan soal mana yang dikonsumsi.
--
-- Fix: extend trigger consume (bukan trigger baru) - setelah insert
-- entri konsumsi, cek sisa sesi membership itu. Kalau habis (<=0):
--   1. Tandai membership itu 'completed'.
--   2. Promosikan membership 'pending' PALING LAMA (FIFO by created_at)
--      milik member yang sama jadi 'active'.
--
-- KETERBATASAN YANG DISENGAJA (didokumentasikan, bukan disembunyikan):
-- kalau attendance yang menyebabkan exhaustion ini DIHAPUS belakangan
-- (uncheck kehadiran), completion+promotion TIDAK di-rollback otomatis -
-- membership yang sudah ke-promote tetap 'active', yang completed tetap
-- 'completed'. Edge case ini jarang terjadi (butuh instruktur uncheck
-- attendance lama SETELAH siklus promosi sudah jalan) - kalau terjadi,
-- perlu koreksi manual oleh instruktur. Ditunda, bukan dianggap selesai.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_membership_consumption()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_membership      RECORD;
  v_class_type      class_type;
  v_remaining       INT;
  v_next_pending_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE membership_consumptions
    SET reversed_at = NOW(), reversed_reason = 'attendance_deleted'
    WHERE attendance_id = OLD.id AND reversed_at IS NULL;
    RETURN OLD;
  END IF;

  -- TG_OP = 'INSERT'
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.type INTO v_class_type
  FROM sessions s JOIN classes c ON c.id = s.class_id
  WHERE s.id = NEW.session_id;

  SELECT mm.* INTO v_membership
  FROM member_memberships mm
  JOIN membership_packages mp ON mp.id = mm.package_id
  WHERE mm.member_id = NEW.member_id
    AND mm.status = 'active'
    AND mm.package_type = 'session_pack'
    AND (mp.class_type IS NULL OR mp.class_type = v_class_type)
  LIMIT 1;

  IF v_membership.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO membership_consumptions (user_id, membership_id, attendance_id)
  VALUES (NEW.user_id, v_membership.id, NEW.id);

  -- Cek exhaustion SETELAH insert di atas (supaya entri yang baru saja
  -- dibuat ikut terhitung).
  SELECT v_membership.total_sessions - count(*) INTO v_remaining
  FROM membership_consumptions
  WHERE membership_id = v_membership.id AND reversed_at IS NULL;

  IF v_remaining <= 0 THEN
    UPDATE member_memberships SET status = 'completed' WHERE id = v_membership.id;

    SELECT id INTO v_next_pending_id
    FROM member_memberships
    WHERE member_id = NEW.member_id AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_next_pending_id IS NOT NULL THEN
      UPDATE member_memberships SET status = 'active' WHERE id = v_next_pending_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
