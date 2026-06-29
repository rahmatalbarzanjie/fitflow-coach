-- ─────────────────────────────────────────────────────────────────
-- 052_laporan_revenue_rpc.sql
-- Laporan V2 Sprint 1 - revenue jadi single source of truth lewat RPC,
-- supaya Beranda dan Laporan TIDAK PERNAH lagi punya formula revenue
-- yang beda (insiden lama: migrasi 046, Rp0 vs Rp465.000).
--
-- Generalisasi formula get_dashboard_summary (048) dari "month-to-date"
-- (>= p_month_start) jadi rentang tanggal eksplisit (BETWEEN start/end),
-- supaya Laporan bisa pilih periode bebas (bulan lalu, bulan ini, dst),
-- tetap pakai filter confirmed_at yang sama persis (uang yang PERNAH
-- dikonfirmasi diterima - fakta historis, bukan status saat ini).
--
-- Tambahan dari formula lama:
--  - Split event vs class revenue (registrations.event_id/class_id -
--    dijamin mutually exclusive oleh CHECK constraint
--    registrations_one_parent, migrasi 021, jadi aman di-split tanpa
--    join tambahan)
--  - Pending/outstanding revenue - SENGAJA TIDAK difilter periode
--    (pending = uang yang BELUM clear SAMPAI SEKARANG, bukan
--    pertanyaan "di bulan X" - instruktur perlu tahu SEMUA yang masih
--    pending, kapan pun terdaftarnya)
--  - Breakdown metode bayar (cash/transfer) dari registrations +
--    attendance walkin, NULL di-COALESCE ke 'lainnya' (data sebelum
--    migrasi 021 belum punya payment_method). member_memberships
--    TIDAK punya kolom payment_method sama sekali - sengaja tidak
--    dipaksa masuk breakdown ini.
-- ─────────────────────────────────────────────────────────────────

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
