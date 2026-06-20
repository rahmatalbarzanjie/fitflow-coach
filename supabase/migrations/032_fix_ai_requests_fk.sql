-- ============================================================
-- Migration 032: perbaiki FK ai_requests.user_id
--
-- Bug: FK mengarah ke public.users, tabel yang tidak pernah diisi
-- oleh trigger signup mana pun (handle_new_user() cuma insert ke
-- profiles). Akibatnya INSERT ke ai_requests selalu gagal dengan
-- foreign key violation untuk SEMUA user - baru ketahuan sekarang
-- karena draft-broadcast adalah pemanggil pertama yang benar-benar
-- coba insert ke tabel ini.
--
-- Fix: arahkan ke auth.users(id), konsisten dengan FK lain di
-- seluruh skema (profiles, members, classes, dll semua mengarah
-- ke auth.users).
-- ============================================================

ALTER TABLE ai_requests
  DROP CONSTRAINT IF EXISTS ai_requests_user_id_fkey;

ALTER TABLE ai_requests
  ADD CONSTRAINT ai_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
