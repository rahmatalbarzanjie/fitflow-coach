-- ─────────────────────────────────────────────────────────────────
-- 047_create_class_registration_rpc.sql
-- P1-D + P2-D - Master UAT Landing Page, confirmed live 2026-06-25:
--   - Capacity oversell: ClassRegistrationForm.tsx inserted directly
--     into `registrations` from the browser with zero server-side
--     capacity re-check at insert time (unlike Event, which already
--     got create_event_registration's row-lock treatment). Proven
--     live: 2 concurrent inserts against a capacity=1 class with 0
--     existing registrations both succeeded -> 2/1.
--   - Duplicate/accidental resubmit: identical registrant
--     (name+phone+class+date) could submit repeatedly with zero
--     guard. Proven live: 2 identical inserts 0.36s apart both
--     succeeded as separate rows.
--
-- Fix: same architecture as create_event_registration (045) - single
-- RPC, row lock on the parent (classes) row, capacity re-validated
-- inside the same transaction as the insert. Also applies the same
-- already-locked pricing principle from the Events remediation
-- ("browser tidak boleh menentukan harga") as a low-cost consistency
-- fix while this RPC is being built anyway: amount_paid is computed
-- server-side from classes.class_price, not trusted from the client.
--
-- Duplicate guard: idempotent, not a hard rejection. If an identical
-- registrant (same class_id+session_date+registrant_phone+
-- registrant_name, case-insensitive on name) already has an active
-- (pending/confirmed) registration, this RETURNS that existing id
-- instead of inserting a new row - no error shown to the participant,
-- no second row created. A phone number shared by multiple distinct
-- people (family/friends registering together) is unaffected, since
-- registrant_name must also match - this only catches genuinely
-- identical resubmissions (double-click survivors, back-button
-- retry, refresh-after-slow-network), not legitimate shared-phone
-- bookings.
--
-- ── SECURITY DEFINER documentation (same shape as 045) ──
-- Who can call it: anon and authenticated (public registrants are
-- never logged in).
-- Why SECURITY DEFINER is required: `SELECT ... FOR UPDATE` on the
-- target `classes` row needs UPDATE-level access under RLS; the
-- `classes: update own` policy requires auth.uid()=user_id, never
-- true for anon. Required specifically for the row lock, not the
-- INSERT itself (anon already has adequate grants for that).
-- Why cross-tenant misattribution is not possible: `user_id` on the
-- inserted row is taken from the locked class row (cls.user_id), not
-- from any caller-supplied parameter.
-- Behavior with an arbitrary/inactive class_id: SELECT...FOR UPDATE
-- filtered to is_active=true finds no row, raises 'class_not_found' -
-- identical shape to a genuinely nonexistent id, no information
-- disclosed beyond what the public page's own 404 already shows.
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

  v_is_free := COALESCE(cls.class_price, 0) <= 0;
  v_amount  := CASE WHEN v_is_free THEN 0 ELSE cls.class_price END;

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
