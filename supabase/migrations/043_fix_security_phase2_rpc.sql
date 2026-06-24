-- ─────────────────────────────────────────────────────────────────
-- 043_fix_security_phase2_rpc.sql
-- Security Phase 2 - two more SECURITY DEFINER functions confirmed
-- vulnerable via live impersonation test 2026-06-24 (same method as
-- migration 042's cancel_registration fix).
--
-- generate_sessions_for_class: User A could call with User B's
-- class_id and a real `sessions` row got created for B's class -
-- confirmed live, row was created and then cleaned up.
--
-- refresh_member_statuses: called with no parameter (the default),
-- updated_at on User B's member row changed even though the call
-- was made impersonating User A only - confirmed live, return value
-- was 2 (both tenants' rows touched by a call from one of them).
-- ─────────────────────────────────────────────────────────────────

-- Fix 1: require the caller to own the class before generating sessions for it.
CREATE OR REPLACE FUNCTION generate_sessions_for_class(p_class_id UUID, p_days_ahead INTEGER DEFAULT 28)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cls          RECORD;
  check_date   DATE;
  end_date     DATE;
  inserted     INT := 0;
BEGIN
  SELECT * INTO cls FROM classes WHERE id = p_class_id;
  IF NOT FOUND OR NOT cls.is_active OR cls.user_id != auth.uid() THEN RETURN 0; END IF;

  check_date := CURRENT_DATE;
  end_date   := CURRENT_DATE + p_days_ahead;

  WHILE check_date <= end_date LOOP
    IF EXTRACT(DOW FROM check_date)::INT = cls.day_of_week THEN
      INSERT INTO sessions (class_id, user_id, session_date, start_time, end_time)
      VALUES (cls.id, cls.user_id, check_date, cls.start_time, cls.end_time)
      ON CONFLICT (class_id, session_date) DO NOTHING;

      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;
    check_date := check_date + 1;
  END LOOP;

  RETURN inserted;
END;
$$;

-- Fix 2: service_role (cron Node-RED) keeps the "refresh everyone" ability
-- (p_user_id NULL); any other caller is forced to their own auth.uid(),
-- regardless of what p_user_id they pass. Unauthenticated (anon) touches
-- nothing.
CREATE OR REPLACE FUNCTION refresh_member_statuses(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count      INT;
  effective_user_id  UUID;
BEGIN
  IF auth.role() = 'service_role' THEN
    effective_user_id := p_user_id;
  ELSE
    effective_user_id := auth.uid();
    IF effective_user_id IS NULL THEN
      RETURN 0;
    END IF;
  END IF;

  UPDATE members
  SET
    status = CASE
      WHEN last_attended_at IS NULL AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 <= 7
        THEN 'new'::member_status
      WHEN last_attended_at IS NULL
        THEN 'inactive'::member_status
      WHEN EXTRACT(EPOCH FROM (NOW() - last_attended_at)) / 86400 <= 14
        THEN 'active'::member_status
      WHEN EXTRACT(EPOCH FROM (NOW() - last_attended_at)) / 86400 <= 30
        THEN 'at_risk'::member_status
      ELSE 'inactive'::member_status
    END,
    updated_at = NOW()
  WHERE (effective_user_id IS NULL OR user_id = effective_user_id);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
