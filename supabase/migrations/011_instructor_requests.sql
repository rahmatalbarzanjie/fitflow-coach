-- Migration 011: Instructor registration requests table
-- Stores pending registrations before admin confirms and creates the actual account

CREATE TABLE IF NOT EXISTS instructor_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  business_name TEXT,
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL,
  city          TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | rejected
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at  TIMESTAMPTZ,
  rejected_at   TIMESTAMPTZ,
  profile_id    UUID REFERENCES auth.users(id)    -- filled when confirmed
);

-- Allow public inserts (no auth needed to submit a request)
ALTER TABLE instructor_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow public insert" ON instructor_requests
  FOR INSERT WITH CHECK (true);

-- Only service role can select/update (admin uses service client)
