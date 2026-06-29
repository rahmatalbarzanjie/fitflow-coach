-- ─────────────────────────────────────────────────────────────────
-- 070_member_summary_derived_status.sql
-- Member Status Architecture Migration, Phase 1 - langkah 3/4.
--
-- `status` di view ini sebelumnya cuma passthrough kolom tersimpan
-- `members.status` (yang dijaga trigger+cron). Sekarang dihitung
-- lewat compute_business_activity_status(068) - SETIAP baca, tidak
-- pernah basi, tidak bergantung refresh_member_statuses()/Node-RED.
--
-- Tambah photo_url/notes/address (belum ada di view ini sebelumnya) -
-- supaya semua konsumen yang sekarang baca `members` langsung bisa
-- pindah ke view ini dengan SATU perubahan nama tabel, bukan menulis
-- ulang query (lihat langkah 4/4 - migrasi konsumen).
--
-- security_invoker=true (di-set migration 041) TETAP berlaku otomatis
-- untuk CREATE OR REPLACE VIEW - tidak perlu di-set ulang di sini.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW member_summary AS
SELECT
  m.id,
  m.user_id,
  m.name,
  m.phone,
  compute_business_activity_status(m.last_attended_at, m.created_at) AS status,
  m.last_attended_at,
  m.created_at,
  COUNT(a.id)::INT                                                         AS total_attended,
  COUNT(a.id) FILTER (
    WHERE DATE_TRUNC('month', a.created_at) = DATE_TRUNC('month', NOW())
  )::INT                                                                    AS attended_this_month,
  COALESCE(SUM(a.amount_paid), 0)                                           AS total_revenue,
  m.photo_url,
  m.notes,
  m.address
FROM members m
LEFT JOIN attendance a ON a.member_id = m.id
GROUP BY m.id, m.user_id, m.name, m.phone, m.last_attended_at, m.created_at, m.photo_url, m.notes, m.address;
