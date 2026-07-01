-- 085_wa_outbox.sql
-- Queue terpusat untuk semua pesan WA keluar.
-- Business routes hanya INSERT ke sini; worker /api/wa/process-queue yang
-- bertanggung jawab kirim ke Fonnte, terapkan delay, dan retry.

CREATE TABLE wa_outbox (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- target: salah satu harus diisi
  target_phone    TEXT,
  target_group_id TEXT,
  message         TEXT        NOT NULL,
  -- snapshot token saat enqueue; jangan lookup live saat worker jalan
  -- supaya token yang sudah expired/diganti tidak kirim ke instruktur salah
  fonnte_token    TEXT        NOT NULL,

  message_type    TEXT        NOT NULL CHECK (message_type IN (
    'registration', 'event', 'reminder', 'broadcast',
    'community', 'chatbot', 'feedback', 'manual', 'system'
  )),
  contact_name    TEXT,
  source_route    TEXT        NOT NULL,
  -- nomor fisik device pengirim; disimpan di sini supaya worker bisa
  -- meneruskan ke wa_message_log tanpa query tambahan ke profiles
  bot_phone       TEXT,

  status          TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'processing', 'sent', 'failed'
  )),
  attempts        SMALLINT    NOT NULL DEFAULT 0,
  max_attempts    SMALLINT    NOT NULL DEFAULT 3,

  -- worker mengambil delay_seconds dari sini kalau ada;
  -- kalau NULL worker pakai random 3-8 detik
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delay_seconds   SMALLINT,
  processing_at   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,

  fonnte_response JSONB,
  error_message   TEXT,

  -- Kode error terstruktur untuk dukungan operasional.
  -- Memungkinkan support menjawab "kenapa pesan ini tidak terkirim?"
  -- tanpa harus baca log server.
  -- Nilai: FONNTE_REJECTED | FONNTE_NETWORK_ERROR |
  --        RECOVERED_FROM_TIMEOUT | MAX_ATTEMPTS_REACHED | null (belum error / sukses)
  last_error_code TEXT,

  CONSTRAINT wa_outbox_target_check
    CHECK (target_phone IS NOT NULL OR target_group_id IS NOT NULL)
);

-- Index untuk worker: ambil baris queued yang sudah siap dikirim
CREATE INDEX idx_wa_outbox_work
  ON wa_outbox(status, scheduled_at)
  WHERE status IN ('queued', 'processing');

-- Index untuk query per instruktur (Activity Center, debug)
CREATE INDEX idx_wa_outbox_user
  ON wa_outbox(user_id, created_at DESC);

ALTER TABLE wa_outbox ENABLE ROW LEVEL SECURITY;

-- Instruktur bisa insert dan lihat outbox milik sendiri
CREATE POLICY "wa_outbox: insert own"
  ON wa_outbox FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wa_outbox: select own"
  ON wa_outbox FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE status hanya lewat service role (worker), tidak ada policy UPDATE client.
-- Ini disengaja: instruktur tidak bisa cancel/retry dari sisi client langsung.
