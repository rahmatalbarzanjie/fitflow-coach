-- Riwayat pembayaran instruktur, dicatat manual oleh admin saat menerima
-- pembayaran. Mengisi baris di sini juga memperpanjang trial_expires_at
-- dan men-set subscription_status = 'active' (lihat /api/admin/record-payment).
CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount           NUMERIC(12,2) NOT NULL,
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  method           TEXT,
  duration_months  INT NOT NULL DEFAULT 1,
  notes            TEXT,
  recorded_by      UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- Tidak ada policy publik — hanya service role (pola sama seperti system_config, migration 012)

CREATE INDEX IF NOT EXISTS idx_payments_profile ON payments(profile_id);
