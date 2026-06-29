-- ─────────────────────────────────────────────────────────────────
-- 066_fix_cancel_membership_returning_bug.sql
-- Bug nyata ditemukan saat verifikasi live 063: `UPDATE ... SET
-- status='cancelled' ... RETURNING member_id, (status='active')` -
-- RETURNING selalu mengevaluasi baris SETELAH update, jadi
-- (status='active') SELALU false (baris itu sudah jadi 'cancelled'
-- duluan). Akibatnya promote_next_eligible_pending TIDAK PERNAH
-- benar-benar terpanggil lewat cancel - persis bug yang seharusnya
-- diperbaiki sprint ini, tapi reintroduced lewat kesalahan RETURNING.
--
-- Fix: tangkap status LAMA via SELECT ... FOR UPDATE dulu (kunci baris
-- + baca nilai sebelum diubah), baru UPDATE - pola yang sama dengan
-- refund_membership (yang sudah benar dari awal, tidak kena bug ini).
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_membership(p_membership_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row FROM member_memberships
    WHERE id = p_membership_id AND status IN ('active', 'pending')
    FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE member_memberships SET status = 'cancelled' WHERE id = p_membership_id;

  IF v_row.status = 'active' THEN
    PERFORM promote_next_eligible_pending(v_row.member_id);
  END IF;

  RETURN TRUE;
END;
$$;
