-- ─────────────────────────────────────────────────────────────────
-- 068_compute_business_activity_status.sql
-- Member Status Architecture Migration, Phase 1 - langkah 1/4.
--
-- Locked di audit sebelumnya (Member Status Architecture Review):
-- status (active/at_risk/inactive) PINDAH dari stored+cron jadi
-- DERIVED murni - dihitung ulang tiap dibaca, tidak pernah disimpan
-- atau bergantung refresh_member_statuses()/Node-RED. last_attended_at
-- TETAP disimpan (murah dijaga lewat trigger, event-driven, sudah
-- terbukti reliable) - cuma KLASIFIKASI-nya yang jadi murni fungsi.
--
-- Logika threshold SAMA PERSIS dengan compute_member_status() lama -
-- ini bukan perubahan definisi bisnis, cuma pindah DARI mana nilainya
-- dihitung (trigger tersimpan -> ekspresi baca-saat-itu).
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_business_activity_status(
  p_last_attended_at TIMESTAMPTZ,
  p_created_at        TIMESTAMPTZ
)
RETURNS member_status
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_last_attended_at IS NULL AND EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 86400 <= 7
      THEN 'new'::member_status
    WHEN p_last_attended_at IS NULL
      THEN 'inactive'::member_status
    WHEN EXTRACT(EPOCH FROM (NOW() - p_last_attended_at)) / 86400 <= 14
      THEN 'active'::member_status
    WHEN EXTRACT(EPOCH FROM (NOW() - p_last_attended_at)) / 86400 <= 30
      THEN 'at_risk'::member_status
    ELSE 'inactive'::member_status
  END;
$$;
