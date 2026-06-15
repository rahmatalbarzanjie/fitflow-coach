-- Migration 010: Add revenue sharing percentage to classes
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS revenue_share_pct smallint NOT NULL DEFAULT 50
  CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100);

COMMENT ON COLUMN classes.revenue_share_pct IS
  'Persentase pendapatan untuk instruktur (0-100). Sisanya untuk studio.';
