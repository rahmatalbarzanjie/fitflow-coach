-- ─────────────────────────────────────────────────────────────────
-- 069_business_activity_event_signal.sql
-- Member Status Architecture Migration, Phase 1 - langkah 2/4.
--
-- Gap dikonfirmasi di audit sebelumnya (Member Activity Definition
-- Audit): last_attended_at HANYA pernah di-update dari tabel
-- `attendance` (kehadiran Kelas) - member yang rutin ikut Event tapi
-- tidak pernah ikut Kelas akan last_attended_at=NULL SELAMANYA, salah
-- diklasifikasikan 'inactive' walau aktif lewat kanal lain.
--
-- Keputusan terkunci: "Business Activity" = Kelas + Event SEKARANG,
-- tapi jangan hardcode logic ke 2 sumber ini - taruh agregasi sumber
-- di SATU primitive (recompute_member_last_attended), supaya nambah
-- sumber aktivitas baru nanti (Challenge/Workshop/Retreat) cuma ubah
-- primitive ini, kode reporting tidak pernah perlu disentuh.
-- ─────────────────────────────────────────────────────────────────

-- ── Primitive bersama: GREATEST dari semua sumber aktivitas ─────────
CREATE OR REPLACE FUNCTION recompute_member_last_attended(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_member_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE members
  SET
    last_attended_at = GREATEST(
      (SELECT MAX(s.session_date)::TIMESTAMPTZ
       FROM attendance a JOIN sessions s ON s.id = a.session_id
       WHERE a.member_id = p_member_id),
      (SELECT MAX(e.event_date)::TIMESTAMPTZ
       FROM registrations r JOIN events e ON e.id = r.event_id
       WHERE r.member_id = p_member_id AND r.event_id IS NOT NULL AND r.attended = true)
    ),
    updated_at = NOW()
  WHERE id = p_member_id;
END;
$$;

-- ── Trigger Kelas (sudah ada sejak 001) - sekarang panggil primitive ──
CREATE OR REPLACE FUNCTION sync_member_last_attended()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM recompute_member_last_attended(COALESCE(NEW.member_id, OLD.member_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Trigger Event (baru) - sumber aktivitas ke-2 ─────────────────────
CREATE OR REPLACE FUNCTION sync_member_last_attended_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.event_id IS NOT NULL AND NEW.attended = true THEN
    PERFORM recompute_member_last_attended(NEW.member_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_last_attended_event ON registrations;
CREATE TRIGGER trigger_sync_last_attended_event
  AFTER UPDATE OF attended ON registrations
  FOR EACH ROW EXECUTE FUNCTION sync_member_last_attended_event();
