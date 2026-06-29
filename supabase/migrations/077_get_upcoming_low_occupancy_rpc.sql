-- ─────────────────────────────────────────────────────────────────
-- 077_get_upcoming_low_occupancy_rpc.sql
-- Laporan V2 Phase 2 - Action Required (low occupancy alert).
--
-- SENGAJA TERPISAH dari get_class_occupancy (053) - itu backward-
-- looking dan ikut filter periode Laporan; ini forward-looking,
-- fixed 7 hari ke depan dari HARI INI, lepas dari periode yang
-- dipilih instruktur di halaman Laporan.
--
-- Sesi yang belum terjadi belum punya baris `attendance` - sinyal
-- "terisi berapa" untuk sesi MENDATANG adalah REGISTRASI (booking),
-- bukan attendance. Kelas tanpa capacity (NULL/0) dikecualikan -
-- tidak ada makna "occupancy rendah" untuk kapasitas tanpa batas.
--
-- Pakai (now() AT TIME ZONE 'Asia/Jakarta')::date, bukan CURRENT_DATE
-- mentah - konsisten dengan WIB-correctness yang sudah dipegang di
-- 064 (nightly sweep), menghindari kelas bug "raw UTC vs WIB" yang
-- sudah jadi backlog item lama di proyek ini.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_upcoming_low_occupancy(
  p_user_id        UUID,
  p_threshold_pct  NUMERIC DEFAULT 30
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  WITH upcoming AS (
    SELECT
      s.id          AS session_id,
      c.id          AS class_id,
      c.name        AS class_name,
      s.session_date,
      c.capacity,
      COALESCE(r.booked_count, 0) AS booked_count
    FROM sessions s
    JOIN classes c ON c.id = s.class_id
    LEFT JOIN (
      SELECT class_id, session_date, count(*) AS booked_count
      FROM registrations
      WHERE user_id = p_user_id AND class_id IS NOT NULL
        AND payment_status IN ('pending', 'confirmed')
      GROUP BY class_id, session_date
    ) r ON r.class_id = s.class_id AND r.session_date = s.session_date
    WHERE s.user_id = p_user_id
      AND s.session_date >= (now() AT TIME ZONE 'Asia/Jakarta')::date
      AND s.session_date <= (now() AT TIME ZONE 'Asia/Jakarta')::date + 7
      AND c.capacity IS NOT NULL AND c.capacity > 0
  )
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      session_id, class_id, class_name, session_date, capacity, booked_count,
      ROUND(100.0 * booked_count / capacity) AS occupancy_pct
    FROM upcoming
    WHERE (100.0 * booked_count / capacity) < p_threshold_pct
    ORDER BY session_date
  ) t;
$$;
