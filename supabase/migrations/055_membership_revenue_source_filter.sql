-- ─────────────────────────────────────────────────────────────────
-- 055_membership_revenue_source_filter.sql
-- Lanjutan 054 - revenue membership di get_dashboard_summary (Beranda)
-- dan get_laporan_revenue (Laporan V2) sekarang cuma menghitung
-- member_memberships dengan source='fitflow'. Member legacy (migrasi
-- CAREA dkk) tidak pernah masuk hitungan revenue - itu uang yang
-- sudah diterima sebelum FitFlow dipakai.
--
-- Formula lain (registrations, attendance walkin) TIDAK berubah -
-- cuma baris member_memberships yang disentuh, persis prinsip yang
-- dikunci di docs/MEMBERSHIP_LIFECYCLE_ENGINE_DESIGN.md §5.
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
          AND source = 'fitflow'
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

CREATE OR REPLACE FUNCTION get_laporan_revenue(
  p_user_id      UUID,
  p_period_start DATE,
  p_period_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'revenue_event', COALESCE((
      SELECT sum(amount_paid) FROM registrations
      WHERE user_id = p_user_id AND event_id IS NOT NULL
        AND confirmed_at IS NOT NULL
        AND confirmed_at >= p_period_start AND confirmed_at < (p_period_end + 1)
    ), 0),
    'revenue_class', COALESCE((
      SELECT sum(amount_paid) FROM registrations
      WHERE user_id = p_user_id AND class_id IS NOT NULL
        AND confirmed_at IS NOT NULL
        AND confirmed_at >= p_period_start AND confirmed_at < (p_period_end + 1)
    ), 0),
    'revenue_membership', COALESCE((
      SELECT sum(purchase_price) FROM member_memberships
      WHERE user_id = p_user_id AND purchase_price > 0
        AND created_at >= p_period_start AND created_at < (p_period_end + 1)
        AND source = 'fitflow'
    ), 0),
    'revenue_walkin', COALESCE((
      SELECT sum(amount_paid) FROM attendance
      WHERE user_id = p_user_id AND source = 'walkin'
        AND created_at >= p_period_start AND created_at < (p_period_end + 1)
    ), 0),
    'pending_count', (
      SELECT count(*) FROM registrations
      WHERE user_id = p_user_id AND payment_status = 'pending'
    ),
    'pending_amount', COALESCE((
      SELECT sum(amount_paid) FROM registrations
      WHERE user_id = p_user_id AND payment_status = 'pending'
    ), 0),
    'payment_method_breakdown', (
      SELECT COALESCE(json_object_agg(method, total), '{}'::json) FROM (
        SELECT COALESCE(payment_method::text, 'lainnya') AS method, sum(amount_paid) AS total
        FROM (
          SELECT payment_method, amount_paid FROM registrations
          WHERE user_id = p_user_id AND confirmed_at IS NOT NULL
            AND confirmed_at >= p_period_start AND confirmed_at < (p_period_end + 1)
          UNION ALL
          SELECT payment_method, amount_paid FROM attendance
          WHERE user_id = p_user_id AND source = 'walkin'
            AND created_at >= p_period_start AND created_at < (p_period_end + 1)
        ) combined
        GROUP BY COALESCE(payment_method::text, 'lainnya')
      ) grouped
    )
  );
$$;
