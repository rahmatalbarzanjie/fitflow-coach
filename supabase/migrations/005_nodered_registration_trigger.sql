-- ============================================================
-- Migration 005: Node-RED Trigger untuk Notifikasi Registrasi Baru
-- ============================================================
-- Jalankan ini di Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- Aktifkan pg_net jika belum aktif (biasanya sudah aktif di Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ── Function: kirim notifikasi ke Node-RED saat ada registrasi baru ──────────
CREATE OR REPLACE FUNCTION public.notify_nodered_new_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kirim HTTP POST ke Node-RED secara asynchronous (non-blocking)
  PERFORM extensions.net.http_post(
    url     := 'https://nodered.sistemtelemetri.com/fitflow/new-registration',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body    := jsonb_build_object(
      'type',       'INSERT',
      'table',      'registrations',
      'schema',     'public',
      'record',     to_jsonb(NEW),
      'old_record', NULL::jsonb
    )::text,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Jangan gagalkan INSERT jika Node-RED tidak bisa dihubungi
    RAISE WARNING 'notify_nodered_new_registration error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ── Trigger: jalankan function setiap ada INSERT ke registrations ─────────────
DROP TRIGGER IF EXISTS on_registration_insert ON public.registrations;

CREATE TRIGGER on_registration_insert
  AFTER INSERT ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nodered_new_registration();

-- ── Verifikasi: cek apakah trigger berhasil dibuat ───────────────────────────
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table  = 'registrations';

-- ============================================================
-- CARA UBAH URL NODE-RED (jika pindah server):
-- Edit function di atas, ganti URL-nya, lalu jalankan lagi.
--
-- CARA NONAKTIFKAN TRIGGER:
--   ALTER TABLE registrations DISABLE TRIGGER on_registration_insert;
--
-- CARA AKTIFKAN KEMBALI:
--   ALTER TABLE registrations ENABLE TRIGGER on_registration_insert;
--
-- CARA HAPUS TRIGGER (permanen):
--   DROP TRIGGER on_registration_insert ON public.registrations;
--   DROP FUNCTION public.notify_nodered_new_registration();
-- ============================================================
