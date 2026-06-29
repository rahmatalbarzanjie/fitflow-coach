-- ─────────────────────────────────────────────────────────────────
-- 073_fix_event_activity_trigger_coverage.sql
-- Bug nyata ditemukan saat review Phase 1 (bukan oleh saya sendiri -
-- ditemukan lewat pertanyaan eksplisit "cek semua skenario": attended
-- false->true, true->false, true->NULL, registration delete).
--
-- Trigger 069 cuma menangani SATU arah: attended jadi true. Function-
-- nya punya guard `IF NEW.attended = true THEN PERFORM recompute...`
-- yang secara tidak sengaja mem-blokir recompute justru saat recompute
-- PALING dibutuhkan: attended dibalik ke false (instruktur salah
-- tandai, lalu dibetulkan), atau baris registrasinya DIHAPUS sama
-- sekali (P2-F: "Delete Registration" memang ada di produk). Di kedua
-- kasus itu, members.last_attended_at TETAP pegang nilai LAMA yang
-- sekarang salah (terlalu baru / overstated) - tidak pernah dikoreksi
-- turun, karena trigger tidak pernah dipanggil sama sekali untuk path
-- penghapusan/pembalikan.
--
-- Skenario "attended true->NULL" DIKONFIRMASI MUSTAHIL - kolom
-- `attended` adalah BOOLEAN NOT NULL DEFAULT FALSE (001 baris 183),
-- Postgres menolak UPDATE yang mencoba set NULL pada kolom ini SEBELUM
-- trigger AFTER sempat jalan - tidak butuh perbaikan apa pun.
--
-- Fix: trigger sekarang AFTER INSERT OR UPDATE OF attended OR DELETE
-- (simetris dengan trigger sisi Kelas yang dari awal sudah benar:
-- AFTER INSERT OR DELETE), dan function TIDAK LAGI menggerbang pada
-- nilai attended tertentu - selalu panggil recompute kalau member_id+
-- event_id relevan ada, biarkan query GREATEST di recompute_member_
-- last_attended_at sendiri yang menentukan hasil benarnya dari kondisi
-- TERKINI tabel (bukan dari nilai NEW yang sedang diasumsikan).
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_member_last_attended_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_member_id UUID;
  target_event_id   UUID;
BEGIN
  target_member_id := COALESCE(NEW.member_id, OLD.member_id);
  target_event_id   := COALESCE(NEW.event_id, OLD.event_id);

  IF target_member_id IS NOT NULL AND target_event_id IS NOT NULL THEN
    PERFORM recompute_member_last_attended(target_member_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_last_attended_event ON registrations;
CREATE TRIGGER trigger_sync_last_attended_event
  AFTER INSERT OR UPDATE OF attended OR DELETE ON registrations
  FOR EACH ROW EXECUTE FUNCTION sync_member_last_attended_event();
