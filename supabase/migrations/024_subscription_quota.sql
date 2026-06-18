-- Paket berbayar dibedakan dari kuota (jumlah kelas aktif & broadcast WA per
-- bulan), bukan dari fitur. Semua nullable, default NULL = unlimited, supaya
-- akun yang sudah ada sekarang tidak tiba-tiba terkunci - limit baru cuma
-- berlaku untuk instruktur yang di-set admin secara eksplisit saat onboarding
-- paket berbayar.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan_name               TEXT,
  ADD COLUMN IF NOT EXISTS max_active_classes      INT,
  ADD COLUMN IF NOT EXISTS max_broadcast_per_month INT;
