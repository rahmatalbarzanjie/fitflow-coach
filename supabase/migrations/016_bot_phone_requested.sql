-- Nomor yang diajukan instruktur untuk ditautkan sebagai bot WA, sebelum
-- disetujui admin dan dapat token device dari Fonnte. Status alur link bot
-- diturunkan dari kombinasi field (tidak perlu kolom status terpisah):
--   none       -> kosong semua
--   pending    -> bot_phone_requested terisi, fonnte_token masih kosong
--   connecting -> fonnte_token terisi, bot_phone masih kosong
--   connected  -> bot_phone terisi
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bot_phone_requested TEXT;
