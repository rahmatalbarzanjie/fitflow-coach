-- ─────────────────────────────────────────────────────────────────
-- 060_fix_helper_function_revoke.sql
-- Ditemukan saat verifikasi 058: `REVOKE EXECUTE ... FROM PUBLIC`
-- TIDAK cukup - terbukti live, anon masih bisa panggil
-- find_member_by_phone langsung dan dapat member_id mentah. Supabase
-- secara default memberi GRANT EXECUTE ke role `anon`/`authenticated`
-- LANGSUNG (bukan cuma lewat PUBLIC) lewat ALTER DEFAULT PRIVILEGES
-- saat fungsi dibuat - REVOKE dari PUBLIC tidak menyentuh grant
-- langsung itu. Perlu REVOKE eksplisit dari anon & authenticated.
-- ─────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION find_member_by_phone(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION member_membership_eligible(UUID, class_type, DATE) FROM PUBLIC, anon, authenticated;
