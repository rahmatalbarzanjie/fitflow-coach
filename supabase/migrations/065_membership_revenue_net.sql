-- ─────────────────────────────────────────────────────────────────
-- 065_membership_revenue_net.sql
-- Sprint Membership Hardening, item 4 (sisi revenue). Sebelum migrasi
-- ini, purchase_price yang sudah di-refund (063) tetap terhitung penuh
-- sebagai revenue selamanya - cancel/refund tidak pernah mengoreksi
-- angka di Dashboard maupun Laporan. Sekarang dikurangi refund_amount.
--
-- Dashboard (get_dashboard_summary) - revenue_month tetap satu angka
-- gabungan (registrasi+membership+walkin), jadi cuma formula
-- internalnya yang dikoreksi jadi net, tanpa ubah bentuk JSON.
--
-- Laporan (get_laporan_revenue) - revenue_membership sudah jadi field
-- terpisah, didefinisikan ulang sebagai NET (konsumen lama otomatis
-- dapat angka yang benar tanpa perlu tahu field baru). Tambah
-- revenue_membership_refunded supaya halaman Laporan bisa hitung
-- Gross = net + refunded untuk tampilan berdampingan, tanpa field ke-3.
--
-- source='legacy' tetap dikecualikan (tidak diubah) - refund pada
-- baris legacy otomatis tidak berpengaruh ke revenue karena baris itu
-- memang sudah tidak pernah ikut terhitung dari awal.
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
        SELECT sum(purchase_price - COALESCE(refund_amount, 0)) FROM member_memberships
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
      SELECT sum(purchase_price - COALESCE(refund_amount, 0)) FROM member_memberships
      WHERE user_id = p_user_id AND purchase_price > 0
        AND created_at >= p_period_start AND created_at < (p_period_end + 1)
        AND source = 'fitflow'
    ), 0),
    'revenue_membership_refunded', COALESCE((
      SELECT sum(refund_amount) FROM member_memberships
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
