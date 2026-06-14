-- ============================================================
-- FitFlow Coach — Migration 004: More Fields
-- Jalankan di Supabase SQL Editor (aman diulang — IF NOT EXISTS)
-- ============================================================

-- ────────────────────────────────────────────
-- 1. MEMBERS: alamat + instagram
-- ────────────────────────────────────────────

ALTER TABLE members ADD COLUMN IF NOT EXISTS address   TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS instagram TEXT;

-- ────────────────────────────────────────────
-- 2. PROFILES: foto instruktur
-- ────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================================
-- STORAGE BUCKET — Buat manual di Supabase Dashboard:
-- Storage → New Bucket → "instructor-photos" → centang Public
--
-- Atau:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('instructor-photos', 'instructor-photos', true)
-- ON CONFLICT (id) DO NOTHING;
-- ============================================================
