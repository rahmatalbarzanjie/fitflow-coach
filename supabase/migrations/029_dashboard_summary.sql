-- ============================================================
-- Migration 029: dashboard_summary RPC
-- Gabungkan 4 query agregat /beranda (attendanceMonth, memberNew,
-- revenueMonth, eventsPending) jadi 1 round-trip.
--
-- Tidak SECURITY DEFINER - tetap jalan sebagai role pemanggil
-- (authenticated), jadi RLS pada attendance/members/registrations/
-- events tetap berlaku seperti query biasa.
-- ============================================================

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
      SELECT COALESCE(sum(amount_paid), 0) FROM attendance
      WHERE user_id = p_user_id AND created_at >= p_month_start
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
