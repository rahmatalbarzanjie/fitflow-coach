-- ============================================================
-- Migration 084: Bagian instruktur per-kelas di laporan
-- classes.revenue_share_pct (migration 010) sudah lama ada tapi cuma
-- dipakai untuk tampilan/kalkulator pratinjau di form - tidak pernah
-- benar-benar dihitung di laporan manapun. Tambahkan net_revenue
-- (bagian instruktur setelah split) di get_class_occupancy supaya
-- instruktur bisa lihat "uang yang benar-benar jadi miliknya" per
-- kelas, bukan cuma total kotor.
--
-- revenue (gross) TIDAK diubah/dihapus - net_revenue ditambahkan
-- sebagai field BARU di samping, sesuai kesepakatan additive bukan
-- ganti makna angka yang sudah ada.
-- ============================================================

CREATE OR REPLACE FUNCTION get_class_occupancy(
  p_user_id      UUID,
  p_period_start DATE,
  p_period_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      c.id,
      c.name,
      c.capacity,
      c.revenue_share_pct,
      COALESCE(s.session_count, 0) AS session_count,
      COALESCE(a.attendance_count, 0) AS attendance_count,
      COALESCE(r.revenue, 0) + COALESCE(w.walkin_revenue, 0) AS revenue,
      ROUND((COALESCE(r.revenue, 0) + COALESCE(w.walkin_revenue, 0)) * c.revenue_share_pct / 100.0) AS net_revenue
    FROM classes c
    LEFT JOIN (
      SELECT class_id, count(*) AS session_count
      FROM sessions
      WHERE user_id = p_user_id
        AND session_date >= p_period_start AND session_date <= p_period_end
      GROUP BY class_id
    ) s ON s.class_id = c.id
    LEFT JOIN (
      SELECT sess.class_id, count(att.id) AS attendance_count
      FROM sessions sess
      JOIN attendance att ON att.session_id = sess.id
      WHERE sess.user_id = p_user_id
        AND sess.session_date >= p_period_start AND sess.session_date <= p_period_end
      GROUP BY sess.class_id
    ) a ON a.class_id = c.id
    LEFT JOIN (
      SELECT reg.class_id, sum(reg.amount_paid) AS revenue
      FROM registrations reg
      WHERE reg.user_id = p_user_id AND reg.class_id IS NOT NULL
        AND reg.confirmed_at IS NOT NULL
        AND reg.confirmed_at >= p_period_start AND reg.confirmed_at < (p_period_end + 1)
        AND (
          reg.payment_method IS DISTINCT FROM 'cash'
          OR EXISTS (
            SELECT 1 FROM attendance att
            JOIN sessions sess ON sess.id = att.session_id
            WHERE sess.class_id = reg.class_id
              AND sess.session_date = reg.session_date
              AND (
                (reg.member_id IS NOT NULL AND att.member_id = reg.member_id)
                OR (reg.member_id IS NULL AND att.registrant_phone = reg.registrant_phone AND att.registrant_name = reg.registrant_name)
              )
          )
        )
      GROUP BY reg.class_id
    ) r ON r.class_id = c.id
    LEFT JOIN (
      SELECT sess.class_id, sum(att.amount_paid) AS walkin_revenue
      FROM sessions sess
      JOIN attendance att ON att.session_id = sess.id
      WHERE sess.user_id = p_user_id
        AND att.source = 'walkin'
        AND sess.session_date >= p_period_start AND sess.session_date <= p_period_end
      GROUP BY sess.class_id
    ) w ON w.class_id = c.id
    WHERE c.user_id = p_user_id AND c.is_active = true
    ORDER BY c.name
  ) t;
$$;
