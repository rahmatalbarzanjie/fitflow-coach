-- ─────────────────────────────────────────────────────────────────
-- 056_fix_consumption_reverse_trigger_timing.sql
-- Bug ditemukan saat verifikasi langsung (UAT internal, bukan
-- asumsi): trigger sync_membership_consumption (054) didaftarkan
-- AFTER INSERT OR DELETE. Untuk DELETE, FK attendance_id ON DELETE
-- SET NULL ternyata sudah menjalankan SET NULL duluan sebelum
-- AFTER-trigger saya jalan - akibatnya WHERE attendance_id = OLD.id
-- di trigger saya tidak match apa pun lagi (sudah ke-null-kan FK-nya),
-- reversed_at tidak pernah terisi. Dikonfirmasi live: attendance_id
-- jadi NULL dengan benar, tapi reversed_at tetap NULL - bug nyata,
-- bukan hipotesis.
--
-- Fix: pisah jadi 2 trigger dengan timing beda.
--  - INSERT tetap AFTER (supaya baris attendance sudah benar-benar
--    ada di tabel saat kita insert baris ledger yang mereferensikan
--    attendance_id-nya - kalau BEFORE, FK violation karena parent
--    belum commit).
--  - DELETE jadi BEFORE (supaya kita baca & update ledger SEBELUM FK
--    SET NULL jalan, bukan sesudah).
-- ─────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_sync_membership_consumption ON attendance;

CREATE TRIGGER trigger_consume_membership_session
  AFTER INSERT ON attendance
  FOR EACH ROW EXECUTE FUNCTION sync_membership_consumption();

CREATE TRIGGER trigger_reverse_membership_consumption
  BEFORE DELETE ON attendance
  FOR EACH ROW EXECUTE FUNCTION sync_membership_consumption();
