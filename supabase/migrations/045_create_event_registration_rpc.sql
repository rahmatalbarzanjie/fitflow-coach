-- ─────────────────────────────────────────────────────────────────
-- 045_create_event_registration_rpc.sql
-- Events P0 Revenue remediation - confirmed live 2026-06-24:
--   - early bird deadline bypass (insert succeeds past deadline)
--   - early bird quota bypass (insert succeeds past quota)
--   - stale tab bypass (client never revalidates before submit)
--   - capacity/quota counters included rejected+cancelled rows
--
-- Root cause: RegistrationForm.tsx inserted directly into
-- `registrations` from the browser, with `tier`/`amount_paid`
-- computed client-side from a page-load snapshot. No server
-- re-validation existed anywhere in the write path.
--
-- Fix: create_event_registration() becomes the single source of
-- truth for tier/amount_paid/quota/deadline/capacity. The client no
-- longer sends tier or amount_paid at all - only event_id, name,
-- phone, proof_url. No guardrail trigger (user's explicit call,
-- 2026-06-24): comparing stored amount_paid against the event's
-- CURRENT price would break historical rows if pricing rules change
-- later - the RPC alone is the source of truth for this remediation.
--
-- ── SECURITY DEFINER documentation (required before shipping) ──
--
-- Who can call it: anon and authenticated (public registrants are
-- never logged in - this must work unauthenticated).
--
-- Why SECURITY DEFINER is required: the function takes
-- `SELECT ... FOR UPDATE` on the target `events` row, to serialize
-- concurrent registrations racing for the last early-bird/capacity
-- slot (this is what actually closes the TOCTOU race - not the
-- function body alone). Confirmed via catalog: the `events: update
-- own` RLS policy requires `auth.uid() = user_id`, which is never
-- true for an anonymous caller. Under SECURITY INVOKER, anon's
-- `FOR UPDATE` would fail outright (Postgres evaluates `FOR UPDATE`
-- against the UPDATE policy, not just SELECT). SECURITY DEFINER is
-- therefore required specifically for the row-lock step, not for
-- the insert itself (anon already has adequate grants for that).
--
-- Why cross-tenant access is not possible: `user_id` on the inserted
-- registration is taken from `ev.user_id` (looked up server-side from
-- the locked event row) - there is no `user_id` or owner parameter in
-- the function signature at all, so a caller cannot direct a
-- registration to be attributed to any tenant other than the actual
-- owner of the event they are registering for. The function only
-- INSERTs new rows (never UPDATEs/DELETEs existing ones) and only
-- READs `events` filtered to `status='published'` - data already
-- publicly visible via the existing landing/registration pages.
--
-- Behavior with an arbitrary/guessed event_id: if it doesn't exist or
-- isn't `status='published'` (e.g. someone else's draft event), the
-- `SELECT ... FOR UPDATE` finds no row and the function raises
-- 'event_not_found' - identical response shape to a real nonexistent
-- ID, so no information is disclosed about unpublished events that
-- isn't already available via the public page's own 404 behavior.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_event_registration(
  p_event_id          UUID,
  p_registrant_name   TEXT,
  p_registrant_phone  TEXT,
  p_proof_url         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ev                  RECORD;
  v_early_bird_used   INT;
  v_total_used         INT;
  v_deadline_passed    BOOLEAN;
  v_quota_full         BOOLEAN;
  v_early_bird_avail   BOOLEAN;
  v_tier               registration_tier;
  v_amount             NUMERIC;
  v_registration_id    UUID;
BEGIN
  IF p_registrant_name IS NULL OR length(trim(p_registrant_name)) = 0 THEN
    RAISE EXCEPTION 'registrant_name_required';
  END IF;
  IF p_registrant_phone IS NULL OR length(trim(p_registrant_phone)) = 0 THEN
    RAISE EXCEPTION 'registrant_phone_required';
  END IF;

  SELECT * INTO ev FROM events WHERE id = p_event_id AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  v_deadline_passed := ev.early_bird_deadline IS NOT NULL AND ev.early_bird_deadline < NOW();

  SELECT COUNT(*) INTO v_early_bird_used FROM registrations
    WHERE event_id = p_event_id AND tier = 'early_bird'
      AND payment_status IN ('pending', 'confirmed');

  v_quota_full       := ev.early_bird_quota IS NOT NULL AND v_early_bird_used >= ev.early_bird_quota;
  v_early_bird_avail := ev.early_bird_price > 0 AND NOT v_deadline_passed AND NOT v_quota_full;

  v_tier   := CASE WHEN v_early_bird_avail THEN 'early_bird'::registration_tier ELSE 'ots'::registration_tier END;
  v_amount := CASE WHEN v_tier = 'early_bird' THEN ev.early_bird_price ELSE ev.ots_price END;

  SELECT COUNT(*) INTO v_total_used FROM registrations
    WHERE event_id = p_event_id AND payment_status IN ('pending', 'confirmed');

  IF ev.max_capacity IS NOT NULL AND v_total_used >= ev.max_capacity THEN
    RAISE EXCEPTION 'event_full';
  END IF;

  INSERT INTO registrations (event_id, user_id, registrant_name, registrant_phone, tier, amount_paid, payment_status, proof_url)
  VALUES (p_event_id, ev.user_id, trim(p_registrant_name), trim(p_registrant_phone), v_tier, v_amount, 'pending', p_proof_url)
  RETURNING id INTO v_registration_id;

  RETURN v_registration_id;
END;
$$;
