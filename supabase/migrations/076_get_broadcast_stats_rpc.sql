-- ─────────────────────────────────────────────────────────────────
-- 076_get_broadcast_stats_rpc.sql
-- Laporan V2 Phase 2 - Marketing section.
--
-- broadcast_recipients TIDAK punya user_id langsung (dikonfirmasi
-- saat riset) - scope lewat broadcasts.user_id. Filter periode pakai
-- broadcasts.sent_at (kapan broadcast itu DIKIRIM), bukan
-- broadcast_recipients.created_at - satu broadcast = satu kejadian
-- kirim, recipient-recipient-nya ikut periode broadcast induknya.
--
-- Delivery rate DIHITUNG DI SISI KLIEN dari sent/failed/pending yang
-- dikembalikan di sini, bukan di RPC - supaya rumus
-- sent/(sent+failed+pending) (locked, pending WAJIB ikut penyebut,
-- lihat KPI Trust Audit) tetap satu tempat di kode aplikasi, bukan
-- terduplikasi antara SQL dan TS kalau formula ini perlu diubah lagi.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_broadcast_stats(
  p_user_id      UUID,
  p_period_start DATE,
  p_period_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'sent_count', COALESCE((
      SELECT count(*) FROM broadcast_recipients br
      JOIN broadcasts b ON b.id = br.broadcast_id
      WHERE b.user_id = p_user_id
        AND b.sent_at >= p_period_start AND b.sent_at < (p_period_end + 1)
        AND br.status = 'sent'
    ), 0),
    'failed_count', COALESCE((
      SELECT count(*) FROM broadcast_recipients br
      JOIN broadcasts b ON b.id = br.broadcast_id
      WHERE b.user_id = p_user_id
        AND b.sent_at >= p_period_start AND b.sent_at < (p_period_end + 1)
        AND br.status = 'failed'
    ), 0),
    'pending_count', COALESCE((
      SELECT count(*) FROM broadcast_recipients br
      JOIN broadcasts b ON b.id = br.broadcast_id
      WHERE b.user_id = p_user_id
        AND b.sent_at >= p_period_start AND b.sent_at < (p_period_end + 1)
        AND br.status = 'pending'
    ), 0)
  );
$$;
