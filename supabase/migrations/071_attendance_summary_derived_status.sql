-- ─────────────────────────────────────────────────────────────────
-- 071_attendance_summary_derived_status.sql
-- Member Status Architecture Migration, Phase 1 - konsumen tambahan
-- ditemukan saat audit blast radius (bukan di daftar awal): view
-- `attendance_summary` (026) juga punya kolom `member_status` sebagai
-- passthrough mentah dari `members.status`. Tidak ada kode aplikasi
-- yang membaca kolom ini hari ini (dikonfirmasi via grep), TAPI kalau
-- dibiarkan, ini jadi jebakan laten - fitur masa depan yang baca
-- kolom ini akan diam-diam dapat nilai basi begitu trigger lama
-- dihapus (072).
--
-- `m` di-LEFT JOIN (bisa NULL untuk attendance walk-in/komunitas) -
-- bungkus dengan CASE supaya tetap NULL kalau memang tidak ada member
-- yang cocok, bukan ikut dihitung jadi 'inactive' - menjaga semantik
-- NULL yang sama dengan sebelumnya, cuma sumber nilainya yang berubah
-- dari stored jadi derived.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW attendance_summary AS
SELECT
  a.id,
  a.session_id,
  a.user_id,
  a.source,
  a.payment_mode,
  a.payment_method,
  a.amount_paid,
  a.notes,
  a.created_at,
  COALESCE(m.name, cc.name, a.registrant_name)   AS participant_name,
  COALESCE(m.phone, cc.phone, a.registrant_phone) AS participant_phone,
  a.member_id,
  CASE WHEN m.id IS NOT NULL
    THEN compute_business_activity_status(m.last_attended_at, m.created_at)
  END AS member_status,
  a.community_id,
  cc.class_type AS community_class_type,
  s.session_date,
  s.class_id,
  c.name  AS class_name,
  c.type  AS class_type
FROM attendance a
LEFT JOIN members           m  ON m.id  = a.member_id
LEFT JOIN community_contacts cc ON cc.id = a.community_id
JOIN  sessions              s  ON s.id  = a.session_id
JOIN  classes               c  ON c.id  = s.class_id;
