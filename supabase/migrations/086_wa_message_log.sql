-- 086_wa_message_log.sql
-- Log permanen semua aktivitas WA (inbound + outbound).
-- Basis data untuk WhatsApp Activity Center instruktur.
-- INSERT hanya lewat service role (worker dan wa/incoming route).

CREATE TABLE wa_message_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- info kontak pengirim/penerima
  contact_name        TEXT,
  contact_phone       TEXT        NOT NULL,

  -- klasifikasi pesan
  direction           TEXT        NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  message_type        TEXT        NOT NULL CHECK (message_type IN (
    'registration', 'event', 'reminder', 'broadcast',
    'community', 'chatbot', 'feedback', 'manual', 'system'
  )),
  message_content     TEXT        NOT NULL,

  -- analisis konten (diisi saat log, bukan saat kirim)
  contains_url        BOOLEAN     NOT NULL DEFAULT false,
  url_count           SMALLINT    NOT NULL DEFAULT 0,
  character_count     INT         NOT NULL DEFAULT 0,

  -- identifikasi perangkat yang mengirim (untuk multi-device masa depan)
  bot_phone           TEXT,

  -- referensi ke provider
  provider_message_id TEXT,

  -- asal request
  source_route        TEXT,

  -- hasil pengiriman
  success             BOOLEAN     NOT NULL DEFAULT false,
  error_message       TEXT,

  -- timestamps terpisah untuk pengiriman dan penerimaan
  sent_at             TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,

  -- referensi ke outbox (null untuk pesan inbound atau direct-send chatbot)
  outbox_id           UUID        REFERENCES wa_outbox(id) ON DELETE SET NULL,
  queue_delay_seconds SMALLINT,

  -- soft delete; hard purge oleh pg_cron atau manual setelah 90 hari
  deleted_at          TIMESTAMPTZ
);

-- Index utama Activity Center: per instruktur, terbaru dulu, hanya aktif
CREATE INDEX idx_wa_message_log_user_time
  ON wa_message_log(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index komposit untuk filter kombinasi (direction + type + success)
CREATE INDEX idx_wa_message_log_filters
  ON wa_message_log(user_id, direction, message_type, success, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index untuk lookup via outbox_id (debug, retry tracking)
CREATE INDEX idx_wa_message_log_outbox
  ON wa_message_log(outbox_id)
  WHERE outbox_id IS NOT NULL;

ALTER TABLE wa_message_log ENABLE ROW LEVEL SECURITY;

-- Instruktur bisa SELECT log milik sendiri (yang belum dihapus)
CREATE POLICY "wa_message_log: select own"
  ON wa_message_log FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Instruktur bisa soft-delete log milik sendiri
CREATE POLICY "wa_message_log: update own deleted_at"
  ON wa_message_log FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT hanya service role - tidak ada policy INSERT dari client.
