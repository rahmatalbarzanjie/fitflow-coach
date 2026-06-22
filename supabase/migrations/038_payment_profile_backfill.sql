-- Backfill: event lama yang masih pakai kolom legacy bank_name/bank_account_number/
-- bank_account_name (sebelum Payment Profile ada) dimigrasikan ke Payment Profile +
-- Payment Method. Dedup per user berdasarkan kombinasi (bank_name, account_number,
-- account_name) supaya event-event dengan rekening yang sama tidak membuat Payment
-- Profile duplikat - sesuai keputusan terkunci.
--
-- Kolom bank_name/bank_account_number/bank_account_name di tabel events TIDAK
-- dihapus (rollback safety net). Idempotent: hanya memproses event yang
-- payment_profile_id-nya masih NULL, jadi aman dijalankan ulang.

DO $$
DECLARE
  combo RECORD;
  new_profile_id UUID;
BEGIN
  FOR combo IN
    SELECT DISTINCT
      user_id,
      bank_name,
      bank_account_number,
      bank_account_name
    FROM events
    WHERE bank_name IS NOT NULL
      AND bank_name <> ''
      AND bank_account_number IS NOT NULL
      AND bank_account_number <> ''
      AND payment_profile_id IS NULL
  LOOP
    INSERT INTO payment_profiles (user_id, name, is_active)
    VALUES (
      combo.user_id,
      COALESCE(NULLIF(combo.bank_account_name, ''), 'Rekening') || ' - ' || combo.bank_name,
      true
    )
    RETURNING id INTO new_profile_id;

    INSERT INTO payment_methods (user_id, payment_profile_id, method_type, bank_name, account_number, account_name, sort_order)
    VALUES (
      combo.user_id,
      new_profile_id,
      'bank',
      combo.bank_name,
      combo.bank_account_number,
      NULLIF(combo.bank_account_name, ''),
      0
    );

    UPDATE events
    SET payment_profile_id = new_profile_id
    WHERE user_id = combo.user_id
      AND bank_name = combo.bank_name
      AND bank_account_number = combo.bank_account_number
      AND (bank_account_name = combo.bank_account_name OR (bank_account_name IS NULL AND combo.bank_account_name IS NULL))
      AND payment_profile_id IS NULL;
  END LOOP;
END $$;
