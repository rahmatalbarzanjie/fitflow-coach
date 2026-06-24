-- ─────────────────────────────────────────────────────────────────
-- 042_fix_cancel_registration_ownership.sql
-- Security hotfix - P0 confirmed vulnerability.
--
-- cancel_registration (migration 040) was missing the ownership
-- check present in its sibling functions (confirm_registration,
-- invite_registrant_to_join). Confirmed via live impersonation test
-- 2026-06-24: an authenticated user (and even fully anonymous/anon
-- role) could call cancel_registration(<any registration id>) and
-- successfully flip another tenant's payment_status to 'cancelled',
-- with zero ownership check, because the function is SECURITY
-- DEFINER (bypasses RLS) and EXECUTE is granted to PUBLIC by default.
--
-- Fix: mirror confirm_registration's pattern exactly - add
-- `AND user_id = auth.uid()` to the UPDATE's WHERE clause.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_registration(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE registrations
  SET
    payment_status = 'cancelled',
    cancelled_at    = NOW()
  WHERE id = p_registration_id
    AND user_id = auth.uid();
END;
$$;
