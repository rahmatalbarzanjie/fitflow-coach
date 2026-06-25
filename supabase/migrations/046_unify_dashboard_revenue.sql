-- ─────────────────────────────────────────────────────────────────
-- 046_unify_dashboard_revenue.sql
-- P1-A - Master UAT Dashboard, confirmed live 2026-06-25: Dashboard
-- revenue_month (sum of attendance.amount_paid only) contradicted
-- /laporan's revenue (Rp0 vs Rp465.000, same instructor/month).
--
-- Locked principle (user's explicit instruction): "Samakan definisi
-- Revenue Dashboard dengan Revenue Settlement. Jangan ada dua definisi
-- revenue dalam sistem." This migration replaces revenue_month's
-- formula with the exact same 3-source formula /laporan already uses
-- (registrations.confirmed_at-gated + member_memberships purchase +
-- attendance source='walkin'), instead of maintaining a second,
-- independently-drifting calculation.
--
-- Event + Class revenue are summed together in one query here (unlike
-- /laporan, which keeps them separate only for its Top Event/Top Kelas
-- breakdown display) - the Dashboard widget shows one total, so no
-- need to split by event_id/class_id for this RPC.
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
    )
  );
$$;
