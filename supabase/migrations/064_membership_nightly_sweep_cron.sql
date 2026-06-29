-- ─────────────────────────────────────────────────────────────────
-- 064_membership_nightly_sweep_cron.sql
-- Sprint Membership Hardening, item 2 + 3 (bagian terjadwal).
--
-- Gap audit: TIDAK ADA mekanisme apa pun sebelumnya yang pernah
-- mengubah status 'active' jadi 'expired' saat end_date lewat - baris
-- tetap 'active' selamanya di database (booking eligibility tetap
-- aman karena re-cek end_date sendiri, tapi status mentah jadi
-- jebakan untuk fitur masa depan yang percaya status apa adanya).
--
-- Promosi reaktif (cancel di 063, exhaustion di 057) sudah menangani
-- kasus umum di hari yang sama. Sweep ini adalah jaring pengaman untuk
-- kasus yang TIDAK tertangkap apa pun secara reaktif: pending yang
-- start_date-nya baru tiba TANPA ada attendance/cancel/exhaustion yang
-- terjadi di sekitarnya (member memang sedang tanpa membership aktif
-- sama sekali, jadi tidak ada attendance yang mungkin terjadi untuk
-- memicu apa pun).
--
-- SECURITY DEFINER WAJIB di sini (satu-satunya penggunaan DEFINER yang
-- legitimate di sprint ini) - cron job tidak punya auth.uid() sama
-- sekali, RLS (auth.uid()=user_id) akan memblokir SEMUA baris dari
-- SEMUA tenant kalau fungsi ini tidak bypass RLS secara sengaja.
--
-- Step 2 pakai loop manggil promote_next_eligible_pending (063) per
-- member, bukan menulis ulang predikat "pending tertua yang eligible"
-- sebagai query terpisah - supaya predikat itu cuma hidup di SATU
-- tempat (persis tujuan "1 primitive, banyak caller" di 063).
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION nightly_membership_sweep()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today     DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_member_id UUID;
BEGIN
  -- Step 1: expire membership aktif yang end_date-nya sudah lewat.
  UPDATE member_memberships
  SET status = 'expired'
  WHERE status = 'active' AND end_date < v_today;

  -- Step 2: untuk setiap member yang SEKARANG tanpa membership aktif
  -- (baik karena baru di-expire di atas, atau sebab lain apa pun) dan
  -- punya pending yang start_date-nya sudah tiba, promosikan satu.
  FOR v_member_id IN
    SELECT DISTINCT mm.member_id FROM member_memberships mm
    WHERE mm.status = 'pending' AND mm.start_date <= v_today
      AND NOT EXISTS (
        SELECT 1 FROM member_memberships mm2
        WHERE mm2.member_id = mm.member_id AND mm2.status = 'active'
      )
  LOOP
    PERFORM promote_next_eligible_pending(v_member_id);
  END LOOP;
END;
$$;

-- 17:30 UTC = 00:30 WIB - dijalankan tak lama setelah tengah malam WIB
-- supaya end_date "kemarin" (WIB) sudah pasti lewat tanpa ambigu.
-- cron.schedule meng-upsert berdasar nama job, aman dijalankan ulang.
SELECT cron.schedule('membership-nightly-sweep', '30 17 * * *', 'SELECT nightly_membership_sweep();');
