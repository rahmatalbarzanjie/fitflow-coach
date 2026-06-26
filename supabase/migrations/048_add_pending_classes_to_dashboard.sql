-- ─────────────────────────────────────────────────────────────────
-- 048_add_pending_classes_to_dashboard.sql
-- Confirmed gap (already known from the Operational Readiness Audit,
-- now reported again live by the user 2026-06-26): "Perlu Perhatian"
-- only ever surfaced pending EVENT registrations (`pending_events`) -
-- pending CLASS registrations (peserta menunggu konfirmasi di menu
-- Kelas) never showed up on the dashboard at all, despite being the
-- exact same kind of actionable item.
--
-- Adds `pending_classes` to get_dashboard_summary(), same shape as
-- `pending_events` (id/name/count per class with at least one pending
-- registration). attendance_month/member_new/revenue_month/
-- pending_events are untouched.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_dashboard_summary(p_user_id UUID, p_month_start DATE)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'attendance_month', (
      SELECT count(*) FROM attendance
      WHERE user_id = p_user_id AND created_at >= p_month_start
    ),
    'member_new', (
      SELECT count(*) FROM members
      WHERE user_id = p_user_id AND created_at >= p_month_start
    ),
    'revenue_month', (
      COALESCE((
        SELECT sum(amount_paid) FROM registrations
        WHERE user_id = p_user_id AND confirmed_at IS NOT NULL AND confirmed_at >= p_month_start
      ), 0)
      + COALESCE((
        SELECT sum(purchase_price) FROM member_memberships
        WHERE user_id = p_user_id AND purchase_price > 0 AND created_at >= p_month_start
      ), 0)
      + COALESCE((
        SELECT sum(amount_paid) FROM attendance
        WHERE user_id = p_user_id AND source = 'walkin' AND created_at >= p_month_start
      ), 0)
    ),
    'pending_events', (
      SELECT COALESCE(json_agg(json_build_object('id', e.id, 'title', e.title, 'count', g.cnt)), '[]'::json)
      FROM (
        SELECT r.event_id, count(*) AS cnt
        FROM registrations r
        JOIN events ev ON ev.id = r.event_id
        WHERE ev.user_id = p_user_id AND r.payment_status = 'pending'
        GROUP BY r.event_id
      ) g
      JOIN events e ON e.id = g.event_id
    ),
    'pending_classes', (
      SELECT COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name, 'count', g.cnt)), '[]'::json)
      FROM (
        SELECT r.class_id, count(*) AS cnt
        FROM registrations r
        JOIN classes c ON c.id = r.class_id
        WHERE c.user_id = p_user_id AND r.payment_status = 'pending'
        GROUP BY r.class_id
      ) g
      JOIN classes c ON c.id = g.class_id
    )
  );
$$;
