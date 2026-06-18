-- Riwayat percakapan bot WA AI per thread (instruktur + nomor pengirim).
-- Sebelumnya tiap pesan masuk diproses stateless (sekali panggil Claude,
-- tanpa histori), jadi bot tidak nyambung kalau peserta menjawab
-- pertanyaan klarifikasi atau melanjutkan obrolan. Tabel ini menyimpan
-- riwayat itu supaya bisa dikirim ulang ke Claude tiap pesan baru masuk.
CREATE TABLE wa_conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wa_conversations_thread ON wa_conversations(user_id, phone, created_at);

ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_conversations: select own" ON wa_conversations
  FOR SELECT USING (auth.uid() = user_id);
