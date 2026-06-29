-- ─────────────────────────────────────────────────────────────────
-- 063_membership_promotion_and_cancel_rpc.sql
-- Sprint Membership Hardening, item 1 + 3 + 4.
--
-- Satu primitive dipakai 3 tempat (trigger exhaustion, cancel, nightly
-- sweep di 064) - persis untuk menghindari kelas bug yang sama dengan
-- `used_sessions` lama: logika diduplikasi, satu tempat lupa di-update.
-- Primitive ini SECURITY INVOKER (bukan DEFINER) - kedua caller di
-- migration ini sudah punya privilese memadai di konteksnya sendiri
-- (trigger attendance sudah DEFINER lewat 054/057, cancel_membership
-- jalan di bawah RLS instruktur yang memang berhak update baris
-- miliknya sendiri).
--
-- Promosi sekarang menghormati start_date pending (item 3) - gap lama:
-- trigger 057 promosi FIFO murni by created_at, tidak pernah cek
-- apakah start_date pending itu sudah benar-benar tiba. Pakai tanggal
-- WIB (Asia/Jakarta), bukan CURRENT_DATE mentah - konsisten dengan
-- masalah timezone yang sudah pernah ditemukan di modul lain aplikasi
-- ini (raw UTC vs WIB-correct).
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION promote_next_eligible_pending(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE member_memberships
  SET status = 'active'
  WHERE id = (
    SELECT id FROM member_memberships
    WHERE member_id = p_member_id
      AND status = 'pending'
      AND start_date <= (now() AT TIME ZONE 'Asia/Jakarta')::date
    ORDER BY created_at ASC
    LIMIT 1
  );
END;
$$;

-- ── Rewire trigger exhaustion (057) untuk pakai primitive di atas ──
-- Sama persis dengan 057, cuma blok promosi inline (yang tidak pernah
-- cek start_date) diganti panggilan ke promote_next_eligible_pending.
CREATE OR REPLACE FUNCTION sync_membership_consumption()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_membership      RECORD;
  v_class_type      class_type;
  v_remaining       INT;
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

  SELECT v_membership.total_sessions - count(*) INTO v_remaining
  FROM membership_consumptions
  WHERE membership_id = v_membership.id AND reversed_at IS NULL;

  IF v_remaining <= 0 THEN
    UPDATE member_memberships SET status = 'completed' WHERE id = v_membership.id;
    PERFORM promote_next_eligible_pending(NEW.member_id);
  END IF;

  RETURN NEW;
END;
$$;

-- ── cancel_membership ────────────────────────────────────────────────
-- SECURITY INVOKER - RLS (036) sudah memvalidasi auth.uid()=user_id +
-- member_id/package_id milik instruktur yang sama, RPC ini tidak butuh
-- bypass apa pun. WHERE status IN ('active','pending') membuat re-klik
-- jadi no-op (FOUND=false), bukan error. Promosi pending berikutnya
-- HANYA kalau baris yang baru dibatalkan adalah yang 'active' -
-- membatalkan satu baris 'pending' di antrian tidak mengubah siapa
-- yang aktif, jadi tidak ada yang perlu dipromosikan.
CREATE OR REPLACE FUNCTION cancel_membership(p_membership_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_member_id UUID;
  v_was_active BOOLEAN;
BEGIN
  UPDATE member_memberships
  SET status = 'cancelled'
  WHERE id = p_membership_id AND status IN ('active', 'pending')
  RETURNING member_id, (status = 'active') INTO v_member_id, v_was_active;

  IF v_member_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_was_active THEN
    PERFORM promote_next_eligible_pending(v_member_id);
  END IF;

  RETURN TRUE;
END;
$$;

-- ── refund_membership ───────────────────────────────────────────────
-- Single-shot (bukan ledger) - refund adalah koreksi langka, bukan
-- kejadian berulang. Refund pada baris yang masih 'active'/'pending'
-- OTOMATIS ikut membatalkannya (keputusan user, lihat plan) - mencegah
-- celah "sudah di-refund tapi masih bisa dipakai" tanpa harus mengingat
-- cek refunded_at di setiap query lain yang menyentuh status.
CREATE OR REPLACE FUNCTION refund_membership(
  p_membership_id UUID,
  p_refund_amount NUMERIC,
  p_refund_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row FROM member_memberships WHERE id = p_membership_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'membership_not_found';
  END IF;
  IF v_row.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_refunded';
  END IF;
  IF p_refund_amount IS NULL OR p_refund_amount <= 0 OR p_refund_amount > v_row.purchase_price THEN
    RAISE EXCEPTION 'invalid_refund_amount';
  END IF;

  UPDATE member_memberships
  SET refund_amount = p_refund_amount,
      refund_reason = p_refund_reason,
      refunded_at   = NOW(),
      status        = CASE WHEN status IN ('active', 'pending') THEN 'cancelled' ELSE status END
  WHERE id = p_membership_id;

  IF v_row.status = 'active' THEN
    PERFORM promote_next_eligible_pending(v_row.member_id);
  END IF;
END;
$$;
