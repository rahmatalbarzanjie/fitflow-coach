-- ─────────────────────────────────────────────────────────────────
-- 062_membership_refund_columns.sql
-- Sprint Membership Hardening, item 4 - audit lifecycle menemukan
-- cancel tidak pernah mengoreksi revenue (purchase_price tetap
-- terhitung selamanya walau membership dibatalkan). Refund adalah
-- koreksi finansial yang TERPISAH dari status Ownership (selaras
-- prinsip Sale vs Ownership di docs/MEMBERSHIP_LIFECYCLE_ENGINE_DESIGN.md
-- §1) - tiga kolom nullable di baris yang sama, single-shot (bukan
-- ledger terpisah) karena ini koreksi langka, bukan kejadian berulang
-- seperti consumption.
--
-- CHECK constraint menegakkan invarian di level DB, bukan cuma
-- dipercayakan ke RPC - konsisten dengan unique-active-per-member
-- index yang sudah ada di tabel ini (035).
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE member_memberships
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at   TIMESTAMPTZ;

ALTER TABLE member_memberships
  ADD CONSTRAINT member_memberships_refund_amount_valid
    CHECK (refund_amount IS NULL OR (refund_amount > 0 AND refund_amount <= purchase_price));

ALTER TABLE member_memberships
  ADD CONSTRAINT member_memberships_refunded_at_consistent
    CHECK ((refund_amount IS NULL) = (refunded_at IS NULL));
