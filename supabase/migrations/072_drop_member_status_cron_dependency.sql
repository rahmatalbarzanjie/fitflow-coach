-- ─────────────────────────────────────────────────────────────────
-- 071_drop_member_status_cron_dependency.sql
-- Member Status Architecture Migration, Phase 1 - langkah 4/4 (final).
--
-- Locked di Member Status Engine Audit + Architecture Review:
-- TIDAK BOLEH ada lagi ketergantungan ke refresh_member_statuses()/
-- Node-RED untuk status member - keduanya dihapus di sini.
--
-- members.status (kolom) SENGAJA TIDAK di-drop di migrasi ini -
-- dibiarkan ada tapi tidak pernah ditulis lagi apa pun (jaring
-- pengaman rollback termurah, sesuai instruksi "transition-safe").
-- Drop kolom fisik adalah follow-up terpisah nanti, bukan bagian
-- rilis ini.
--
-- WAJIB dijalankan SETELAH app code (nodered webhook route) tidak
-- lagi memanggil refresh_member_statuses() - urutan sudah dijaga di
-- proses implementasi, migrasi ini di-push terakhir.
-- ─────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_compute_member_status ON members;
DROP FUNCTION IF EXISTS compute_member_status();
DROP FUNCTION IF EXISTS refresh_member_statuses(UUID);
