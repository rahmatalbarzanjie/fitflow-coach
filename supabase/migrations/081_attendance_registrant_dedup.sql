-- ============================================================
-- Migration 081: Cegah duplikat absensi peserta booking/walk-in
-- Index unique sebelumnya (attendance_session_member_unique,
-- attendance_session_community_unique) hanya melindungi peserta yang
-- punya member_id atau community_id. Peserta dari Booking yang TIDAK
-- terhubung ke akun Member (mayoritas kasus) tidak terlindungi sama
-- sekali (member_id DAN community_id sama-sama NULL) - bug di
-- AttendanceSheet menyebabkan baris ini ter-duplikat saat absensi
-- disimpan ulang, tanpa ditolak DB.
-- ============================================================

-- 1. Bersihkan duplikat yang sudah terlanjur tersimpan akibat bug ini.
--    Identitas peserta non-member dipakai (registrant_phone +
--    registrant_name) karena satu nomor HP bisa dipakai >1 orang
--    (mis. nomor keluarga) - bukan registrant_phone saja, supaya tidak
--    salah gabung 2 peserta berbeda yang kebetulan satu nomor.
--    Baris yang dipertahankan: created_at paling awal per kelompok.
DELETE FROM attendance a
USING attendance b
WHERE a.session_id = b.session_id
  AND a.registrant_phone = b.registrant_phone
  AND a.registrant_name = b.registrant_name
  AND a.registrant_phone IS NOT NULL
  AND a.registrant_name IS NOT NULL
  AND (a.created_at, a.id) > (b.created_at, b.id);

-- 2. Unique index sebagai jaring pengaman - non-partial supaya bisa
--    dipakai sebagai target ON CONFLICT oleh Supabase upsert (index
--    parsial perlu predicate eksplisit yang tidak didukung client-nya).
--    NULL tidak pernah dianggap sama dengan NULL di unique index Postgres,
--    jadi baris member-sourced (registrant_phone/name NULL) tetap bebas.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_registrant_unique
  ON attendance(session_id, registrant_phone, registrant_name);
