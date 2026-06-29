-- ─────────────────────────────────────────────────────────────────
-- 053_class_occupancy_rpc.sql
-- Laporan V2 Sprint 1 - section Kelas. Satu RPC, satu round-trip,
-- menghindari N+1 query (classes + sessions + attendance + revenue
-- per kelas kalau ditulis terpisah).
--
-- Revenue per-kelas SENGAJA dihitung di sini (bukan di
-- get_laporan_revenue) supaya tidak ada 2 RPC yang menghitung revenue
-- per-kelas dengan kemungkinan hasil beda - satu sumber kebenaran
-- untuk angka per-kelas, get_laporan_revenue cuma agregat total.
--
-- session_count=0 untuk suatu kelas di periode tertentu BISA berarti
-- "memang tidak ada sesi" ATAU "sesi historis belum pernah di-generate"
-- (sessions cuma di-generate rolling-forward 56 hari, tidak ada
-- backfill retroaktif - lihat src/app/api/sessions/auto-fill/route.ts).
-- RPC ini TIDAK membedakan dua kasus itu (mustahil dibedakan dari data
-- yang ada) - sisi UI WAJIB tampilkan "Tidak ada data sesi", bukan
-- "0% occupancy" yang menyesatkan, untuk session_count=0.
--
-- capacity nullable di tabel classes - RPC tetap kembalikan apa
-- adanya (NULL kalau NULL), occupancy % dihitung di sisi klien supaya
-- gampang guard "Tanpa batas kapasitas" tanpa logic CASE di SQL.
-- ─────────────────────────────────────────────────────────────────

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
      COALESCE(s.session_count, 0)    AS session_count,
      COALESCE(a.attendance_count, 0) AS attendance_count,
      COALESCE(r.revenue, 0)          AS revenue
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
      SELECT class_id, sum(amount_paid) AS revenue
      FROM registrations
      WHERE user_id = p_user_id AND class_id IS NOT NULL
        AND confirmed_at IS NOT NULL
        AND confirmed_at >= p_period_start AND confirmed_at < (p_period_end + 1)
      GROUP BY class_id
    ) r ON r.class_id = c.id
    WHERE c.user_id = p_user_id AND c.is_active = true
    ORDER BY c.name
  ) t;
$$;
