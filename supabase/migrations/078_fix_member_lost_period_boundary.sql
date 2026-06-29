-- ─────────────────────────────────────────────────────────────────
-- 078_fix_member_lost_period_boundary.sql
-- Bug nyata ditemukan saat Phase 2 Review (terbukti live, bukan
-- teori): 075 menghitung "periode sebelumnya" sebagai window
-- SEPANJANG SAMA yang mendahului period_start
-- (`p_period_start - (p_period_end - p_period_start + 1)`). Untuk
-- bulan kalender yang panjangnya BEDA (Juni 30 hari, Mei 31 hari),
-- ini menggeser window mundur 1 hari dari yang seharusnya - dibuktikan
-- live: member yang aktivitas terakhirnya PERSIS 1 Mei tidak terhitung
-- "aktif di periode sebelumnya" untuk laporan Juni (window yang
-- salah jadi 2-31 Mei, bukan 1-31 Mei), padahal seharusnya terhitung
-- Member Lost.
--
-- Fix: berhenti menebak "periode sebelumnya" di dalam SQL - terima
-- sebagai parameter eksplisit dari caller, yang SUDAH punya
-- prevMonthOf()+monthToRange() yang benar secara kalender (dipakai
-- juga untuk perbandingan Revenue Growth di halaman yang sama).
-- Konsisten dengan satu sumber kebenaran untuk "periode sebelumnya",
-- bukan dua cara hitung berbeda untuk dua metrik berbeda.
--
-- Semantik "Member Lost" sendiri SUDAH benar dan dikonfirmasi live -
-- ini cuma TRANSITION EVENT (aktif di periode lalu, hilang di periode
-- ini), bukan status berkelanjutan - member yang sudah hilang sejak
-- April TIDAK dihitung ulang di Mei/Juni, cuma di bulan transisinya.
-- Itu bukan bug, itu cara kerja metrik churn yang benar (sekali per
-- transisi, bukan terus-menerus selama tetap diam).
-- ─────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_member_health(UUID, DATE, DATE);

CREATE FUNCTION get_member_health(
  p_user_id           UUID,
  p_period_start      DATE,
  p_period_end        DATE,
  p_prev_period_start DATE,
  p_prev_period_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  WITH activity AS (
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
      SELECT count(*) FROM members
      WHERE members.user_id = p_user_id
        AND members.created_at >= p_period_start
        AND members.created_at < (p_period_end + 1)
    ),
    'member_lama_aktif_count', (
      SELECT count(*) FROM member_summary
      WHERE member_summary.user_id = p_user_id
        AND member_summary.status = 'active'
        AND member_summary.created_at < p_period_start
    ),
    'member_lost_count', (
      SELECT count(DISTINCT prev.member_id)
      FROM activity prev
      WHERE prev.activity_date >= p_prev_period_start AND prev.activity_date <= p_prev_period_end
        AND NOT EXISTS (
          SELECT 1 FROM activity cur
          WHERE cur.member_id = prev.member_id
            AND cur.activity_date >= p_period_start AND cur.activity_date <= p_period_end
        )
    )
  );
$$;
