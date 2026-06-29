-- ─────────────────────────────────────────────────────────────────
-- 061_fix_ambiguous_column_refs.sql
-- Bug nyata ditemukan saat verifikasi end-to-end 058/059: RETURNS
-- TABLE(id, payment_status, used_membership) membuat plpgsql otomatis
-- mendeklarasikan `id` dan `payment_status` sebagai variabel OUT yang
-- ikut hidup di seluruh badan fungsi. Dua referensi kolom TANPA alias
-- yang sebelumnya aman (saat fungsi masih RETURNS UUID polos) sekarang
-- jadi ambigu:
--   - `WHERE id = p_class_id` (cek classes) - bisa berarti kolom
--     classes.id ATAU variabel OUT `id`.
--   - `WHERE ... AND payment_status IN (...)` (hitung v_total_used) -
--     sama, bisa berarti registrations.payment_status ATAU OUT
--     `payment_status`.
-- Terbukti live: setiap panggilan create_class_registration gagal
-- dengan error 42702 "column reference is ambiguous". Fix: kualifikasi
-- semua referensi kolom yang bertabrakan nama dengan nama tabelnya.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_class_registration(
  p_class_id          UUID,
  p_session_date       DATE,
  p_registrant_name    TEXT,
  p_registrant_phone   TEXT,
  p_payment_method     payment_method DEFAULT NULL,
  p_proof_url           TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, payment_status payment_status, used_membership BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cls               RECORD;
  v_existing        RECORD;
  v_total_used      INT;
  v_is_free         BOOLEAN;
  v_payment_status  payment_status;
  v_amount          NUMERIC;
  v_registration_id UUID;
  v_member_id       UUID;
  v_used_membership BOOLEAN := FALSE;
BEGIN
  IF p_registrant_name IS NULL OR length(trim(p_registrant_name)) = 0 THEN
    RAISE EXCEPTION 'registrant_name_required';
  END IF;
  IF p_registrant_phone IS NULL OR length(trim(p_registrant_phone)) = 0 THEN
    RAISE EXCEPTION 'registrant_phone_required';
  END IF;

  SELECT * INTO cls FROM classes WHERE classes.id = p_class_id AND classes.is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  -- Idempotency: identik dengan registrant yang sudah punya booking
  -- aktif untuk class+date ini - kembalikan baris itu, jangan duplikat.
  SELECT r.id, r.payment_status, r.member_id, r.amount_paid INTO v_existing FROM registrations r
    WHERE r.class_id = p_class_id
      AND r.session_date = p_session_date
      AND r.registrant_phone = trim(p_registrant_phone)
      AND lower(r.registrant_name) = lower(trim(p_registrant_name))
      AND r.payment_status IN ('pending', 'confirmed')
    LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing.id, v_existing.payment_status,
      (v_existing.member_id IS NOT NULL AND v_existing.amount_paid = 0);
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_total_used FROM registrations r
    WHERE r.class_id = p_class_id AND r.session_date = p_session_date
      AND r.payment_status IN ('pending', 'confirmed');

  IF cls.capacity IS NOT NULL AND v_total_used >= cls.capacity THEN
    RAISE EXCEPTION 'class_full';
  END IF;

  v_member_id := find_member_by_phone(cls.user_id, p_registrant_phone);
  v_is_free   := COALESCE(cls.class_price, 0) <= 0;

  IF NOT v_is_free AND member_membership_eligible(v_member_id, cls.type, p_session_date) THEN
    v_used_membership := TRUE;
    v_amount          := 0;
    v_payment_status  := 'confirmed'::payment_status;
  ELSE
    v_amount  := CASE WHEN v_is_free THEN 0 ELSE cls.class_price END;
    v_payment_status := CASE
      WHEN v_is_free THEN 'confirmed'::payment_status
      WHEN p_payment_method = 'cash' THEN 'confirmed'::payment_status
      ELSE 'pending'::payment_status
    END;
  END IF;

  INSERT INTO registrations (
    class_id, session_date, user_id, registrant_name, registrant_phone,
    member_id, tier, amount_paid, payment_method, payment_status, proof_url
  )
  VALUES (
    p_class_id, p_session_date, cls.user_id, trim(p_registrant_name), trim(p_registrant_phone),
    v_member_id, 'ots', v_amount,
    CASE WHEN v_is_free OR v_used_membership THEN NULL ELSE p_payment_method END,
    v_payment_status, p_proof_url
  )
  RETURNING registrations.id INTO v_registration_id;

  RETURN QUERY SELECT v_registration_id, v_payment_status, v_used_membership;
END;
$$;
