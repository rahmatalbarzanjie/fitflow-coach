-- ─────────────────────────────────────────────────────────────────
-- 074_refresh_member_statuses_compat_stub.sql
-- Respons ke review Phase 1, concern #3: 072 men-DROP refresh_member_
-- statuses() sepenuhnya, segera setelah semua caller yang DITEMUKAN
-- dipindah. Tapi pencarian blast-radius awal itu sendiri TERBUKTI
-- tidak lengkap pada percobaan pertama - 4 caller nyata baru ketemu
-- setelah disisir ulang lebih dalam (classes/[id]/attendance,
-- wa/incoming bot, daily-summary, view attendance_summary). Itu fakta
-- yang relevan untuk keputusan ini: kepercayaan "sudah ketemu semua"
-- sebelumnya terbukti meleset sekali di episode yang sama.
--
-- compute_member_status() AMAN didrop permanen tanpa stub - itu
-- TRIGGER FUNCTION (RETURNS TRIGGER), Postgres tidak mengizinkannya
-- dipanggil di luar konteks trigger sama sekali, jadi tidak ada
-- "unknown caller eksternal" yang mungkin ada untuk fungsi ini.
--
-- refresh_member_statuses() BEDA - dia RPC biasa (RETURNS INT),
-- secara teori bisa dipanggil langsung lewat PostgREST oleh skrip/
-- cron/snippet APAPUN di luar codebase ini yang tidak pernah tercatat
-- di git (mis. SQL snippet tersimpan di Supabase Dashboard, atau
-- automation lain yang tidak pernah diaudit). Restore sebagai stub
-- no-op murni (BUKAN nulis ulang members.status - itu akan membuka
-- kembali dual-source-of-truth yang justru jadi alasan migrasi ini)
-- - caller yang belum ketemu dapat respons sukses palsu yang aman
-- (tidak merusak apa pun), bukan error 404 keras.
--
-- INI SENGAJA SEMENTARA - dicatat di sini sebagai utang yang harus
-- ditagih, bukan solusi permanen: setelah ada jendela observasi nyata
-- (saran: minimal beberapa minggu produksi tanpa ada yang melapor
-- error 404 dari sisi mana pun) DAN konfirmasi langsung ke Node-RED
-- (kalau instance-nya pernah ditemukan aktif - lihat audit
-- "Member Status Engine"), stub ini wajib di-drop sungguhan. Jangan
-- biarkan dead code ini bertahan selamanya - itu bertentangan dengan
-- prinsip "kalau yakin tidak dipakai, hapus total" yang sudah dipegang
-- konsisten di proyek ini.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_member_statuses(p_user_id UUID DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 0;
END;
$$;
