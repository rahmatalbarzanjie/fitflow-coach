-- ─────────────────────────────────────────────────────────────────
-- 051_enforce_payment_methods_enabled.sql
-- Lanjutan 050: kolom payment_methods_enabled saja tidak cukup -
-- tanpa validasi server-side, peserta di tab basi (atau panggilan API
-- langsung) tetap bisa kirim payment_method yang seharusnya sudah
-- dimatikan instruktur untuk kelas itu. RPC adalah satu-satunya
-- tempat yang TIDAK BISA dilewati klien (prinsip yang sama dipakai
-- saat fix early-bird/capacity client-trusted bypass di Events).
--
-- v_is_free dipindah ke lebih awal (segera setelah class lookup)
-- supaya bisa dipakai di guard baru - di 047 dia baru dihitung
-- setelah cek kapasitas.
--
-- Sekalian menutup gap kecil yang baru kelihatan saat RPC ini dibuka
-- lagi: p_payment_method NULL di kelas berbayar sebelumnya tidak
-- pernah ditolak eksplisit.
--
-- ── SECURITY DEFINER documentation (sama seperti 047, karakteristik
-- keamanan tidak berubah - cuma menambah validasi) ──
-- Who can call it: anon dan authenticated (peserta publik tidak login).
-- Why SECURITY DEFINER diperlukan: SELECT...FOR UPDATE pada baris
-- classes butuh akses level UPDATE di bawah RLS, kebijakan
-- "classes: update own" mensyaratkan auth.uid()=user_id, tidak pernah
-- true untuk anon.
-- Why cross-tenant misattribution tidak mungkin: user_id pada baris
-- yang diinsert diambil dari baris classes yang sudah di-lock
-- (cls.user_id), bukan dari parameter yang dikirim caller.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_class_registration(
  p_class_id          UUID,
  p_session_date       DATE,
  p_registrant_name    TEXT,
  p_registrant_phone   TEXT,
  p_payment_method     payment_method DEFAULT NULL,
  p_proof_url           TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cls               RECORD;
  v_existing_id     UUID;
  v_total_used      INT;
  v_is_free         BOOLEAN;
  v_payment_status  payment_status;
  v_amount          NUMERIC;
  v_registration_id UUID;
BEGIN
  IF p_registrant_name IS NULL OR length(trim(p_registrant_name)) = 0 THEN
    RAISE EXCEPTION 'registrant_name_required';
  END IF;
  IF p_registrant_phone IS NULL OR length(trim(p_registrant_phone)) = 0 THEN
    RAISE EXCEPTION 'registrant_phone_required';
  END IF;

  SELECT * INTO cls FROM classes WHERE id = p_class_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  v_is_free := COALESCE(cls.class_price, 0) <= 0;

  -- Validasi payment_method terhadap setting kelas - HANYA untuk kelas
  -- berbayar (kelas gratis selalu diabaikan method-nya, lihat di bawah).
  IF NOT v_is_free THEN
    IF p_payment_method IS NULL THEN
      RAISE EXCEPTION 'payment_method_required';
    END IF;
    IF cls.payment_methods_enabled = 'ots_only' AND p_payment_method = 'transfer' THEN
      RAISE EXCEPTION 'payment_method_not_allowed';
    END IF;
    IF cls.payment_methods_enabled = 'transfer_only' AND p_payment_method = 'cash' THEN
      RAISE EXCEPTION 'payment_method_not_allowed';
    END IF;
  END IF;

  -- Idempotency: identical registrant already has an active booking for
  -- this exact class+date - return it instead of creating a duplicate.
  SELECT id INTO v_existing_id FROM registrations
    WHERE class_id = p_class_id
      AND session_date = p_session_date
      AND registrant_phone = trim(p_registrant_phone)
      AND lower(registrant_name) = lower(trim(p_registrant_name))
      AND payment_status IN ('pending', 'confirmed')
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_total_used := (
    SELECT COUNT(*) FROM registrations
    WHERE class_id = p_class_id AND session_date = p_session_date
      AND payment_status IN ('pending', 'confirmed')
  );

  IF cls.capacity IS NOT NULL AND v_total_used >= cls.capacity THEN
    RAISE EXCEPTION 'class_full';
  END IF;

  v_amount := CASE WHEN v_is_free THEN 0 ELSE cls.class_price END;

  v_payment_status := CASE
    WHEN v_is_free THEN 'confirmed'::payment_status
    WHEN p_payment_method = 'cash' THEN 'confirmed'::payment_status
    ELSE 'pending'::payment_status
  END;

  INSERT INTO registrations (
    class_id, session_date, user_id, registrant_name, registrant_phone,
    tier, amount_paid, payment_method, payment_status, proof_url
  )
  VALUES (
    p_class_id, p_session_date, cls.user_id, trim(p_registrant_name), trim(p_registrant_phone),
    'ots', v_amount, CASE WHEN v_is_free THEN NULL ELSE p_payment_method END, v_payment_status, p_proof_url
  )
  RETURNING id INTO v_registration_id;

  RETURN v_registration_id;
END;
$$;
