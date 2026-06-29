-- ─────────────────────────────────────────────────────────────────
-- 075_get_member_health_rpc.sql
-- Laporan V2 Phase 2 - Member Health section.
--
-- Status counts (active/at_risk/inactive) dibaca dari `member_summary`
-- (status DERIVED, Phase 1 - tidak pernah baca members.status mentah).
--
-- member_lost_count SENGAJA dibangun dari log aktivitas mentah
-- (attendance + registrations.attended), BUKAN dari snapshot status -
-- "apakah ada baris aktivitas di window X" selalu bisa direkonstruksi
-- untuk periode lampau manapun tanpa tabel riwayat baru. "Previous
-- period" dihitung sebagai window sepanjang sama yang persis
-- mendahului period_start - generik untuk periode custom, tidak
-- mengasumsikan bulan kalender.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_member_health(
  p_user_id      UUID,
  p_period_start DATE,
  p_period_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    SELECT
      p_period_start AS period_start,
      p_period_end   AS period_end,
      p_period_start - (p_period_end - p_period_start + 1) AS prev_start,
      p_period_start - 1 AS prev_end
  ),
  activity AS (
    SELECT a.member_id, s.session_date AS activity_date
    FROM attendance a JOIN sessions s ON s.id = a.session_id
    WHERE a.user_id = p_user_id AND a.member_id IS NOT NULL
    UNION ALL
    SELECT r.member_id, e.event_date AS activity_date
    FROM registrations r JOIN events e ON e.id = r.event_id
    WHERE r.user_id = p_user_id AND r.member_id IS NOT NULL AND r.attended = true
  )
  SELECT json_build_object(
    'active_count', (
      SELECT count(*) FROM member_summary WHERE user_id = p_user_id AND status = 'active'
    ),
    'at_risk_count', (
      SELECT count(*) FROM member_summary WHERE user_id = p_user_id AND status = 'at_risk'
    ),
    'inactive_count', (
      SELECT count(*) FROM member_summary WHERE user_id = p_user_id AND status = 'inactive'
    ),
    'member_baru_count', (
      SELECT count(*) FROM members, bounds
      WHERE members.user_id = p_user_id
        AND members.created_at >= bounds.period_start
        AND members.created_at < (bounds.period_end + 1)
    ),
    'member_lama_aktif_count', (
      SELECT count(*) FROM member_summary, bounds
      WHERE member_summary.user_id = p_user_id
        AND member_summary.status = 'active'
        AND member_summary.created_at < bounds.period_start
    ),
    'member_lost_count', (
      SELECT count(DISTINCT prev.member_id)
      FROM activity prev, bounds
      WHERE prev.activity_date >= bounds.prev_start AND prev.activity_date <= bounds.prev_end
        AND NOT EXISTS (
          SELECT 1 FROM activity cur
          WHERE cur.member_id = prev.member_id
            AND cur.activity_date >= bounds.period_start AND cur.activity_date <= bounds.period_end
        )
    )
  )
  FROM bounds;
$$;
