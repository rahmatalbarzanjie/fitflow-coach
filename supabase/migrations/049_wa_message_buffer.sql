-- ─────────────────────────────────────────────────────────────────
-- 049_wa_message_buffer.sql
-- Buffer pesan WA masuk untuk debounce pesan beruntun (mis. peserta
-- kirim "kak" lalu 2 detik kemudian "ada kelas yoga besok?" sebagai
-- 2 pesan terpisah) - tanpa ini, bot membalas ke pesan PERTAMA yang
-- belum lengkap. Webhook insert ke sini SEGERA saat pesan masuk, lalu
-- tunggu sebentar; kalau ada pesan lebih baru dari sender yang sama
-- muncul selama nunggu, invocation ini berhenti tanpa balas (biar
-- invocation milik pesan terbaru yang gabungkan semua jadi 1 balasan).
-- Murni tabel pendukung - logic debounce di incoming/route.ts.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE wa_message_buffer (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wa_message_buffer_thread ON wa_message_buffer(user_id, phone, created_at);

ALTER TABLE wa_message_buffer ENABLE ROW LEVEL SECURITY;
-- Sengaja tanpa policy - tabel operasional internal, cuma diakses
-- service-role di webhook route (bypass RLS), sama seperti wa_webhook_log.
