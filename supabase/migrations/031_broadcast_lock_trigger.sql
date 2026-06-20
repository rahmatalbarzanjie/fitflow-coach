-- ============================================================
-- Migration 031: kunci edit broadcast di level data
-- Sebelumnya cuma dikunci di UI (input disabled) - bisa di-bypass
-- karena save() di client tetap bisa panggil update langsung.
-- Trigger ini blok di Postgres, berlaku siapa pun/lewat jalur
-- mana pun yang mencoba update title/content/target_audience.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_broadcast_edit_after_sent()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.title           IS DISTINCT FROM OLD.title
      OR NEW.content      IS DISTINCT FROM OLD.content
      OR NEW.target_audience IS DISTINCT FROM OLD.target_audience)
     AND EXISTS (
       SELECT 1 FROM broadcast_recipients
       WHERE broadcast_id = OLD.id AND status = 'sent'
     )
  THEN
    RAISE EXCEPTION 'Broadcast ini sudah ada penerima yang berhasil terkirim - judul, isi pesan, dan audience tidak bisa diubah lagi.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_broadcast_edit_after_sent ON broadcasts;
CREATE TRIGGER trg_prevent_broadcast_edit_after_sent
  BEFORE UPDATE ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION prevent_broadcast_edit_after_sent();
