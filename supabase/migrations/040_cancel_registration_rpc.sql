-- ─────────────────────────────────────────────────────────────────
-- 040_cancel_registration_rpc.sql
-- RPC cancel_registration - mirror pola confirm_registration (migration
-- 001), supaya registered_at/confirmed_at/cancelled_at konsisten semua
-- dari sumber waktu database (NOW()), bukan campuran client.
--
-- confirmed_at TIDAK dihapus saat cancel - histori valid bahwa
-- registrasi ini pernah dikonfirmasi sebelum akhirnya dibatalkan.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_registration(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE registrations
  SET
    payment_status = 'cancelled',
    cancelled_at    = NOW()
  WHERE id = p_registration_id;
END;
$$;
