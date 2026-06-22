-- ─────────────────────────────────────────────────────────────────
-- 041_fix_security_definer_views.sql
-- Fix cross-tenant data leak: 5 view dibuat tanpa security_invoker,
-- owner = postgres (BYPASSRLS) - artinya RLS pada tabel dasar
-- (registrations/events/classes/members/attendance) DIABAIKAN saat
-- diquery lewat view ini. Dibuktikan nyata: instructor lain (0
-- registrasi miliknya) tetap bisa lihat registrasi instructor lain
-- lewat event_registration_summary sebelum fix ini.
--
-- security_invoker=true membuat Postgres evaluasi RLS pakai privilege
-- USER YANG QUERY (lewat PostgREST/authenticated role), bukan privilege
-- pembuat view. Tidak mengubah definisi/kolom view sama sekali - cuma
-- mode evaluasi RLS-nya.
-- ─────────────────────────────────────────────────────────────────

ALTER VIEW public.event_registration_summary SET (security_invoker = true);
ALTER VIEW public.class_registration_summary SET (security_invoker = true);
ALTER VIEW public.member_summary             SET (security_invoker = true);
ALTER VIEW public.today_sessions             SET (security_invoker = true);
ALTER VIEW public.attendance_summary         SET (security_invoker = true);
