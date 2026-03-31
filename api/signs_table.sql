-- Signs Tracker — run this in your Supabase SQL editor
-- https://app.supabase.com → SQL Editor → New query

CREATE TABLE IF NOT EXISTS signs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  context     TEXT,
  categories  TEXT[] DEFAULT '{}',
  moon_phase  TEXT,
  moon_sign   TEXT,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security — users only see their own signs
ALTER TABLE signs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own signs" ON signs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signs" ON signs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own signs" ON signs
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS signs_user_timestamp ON signs(user_id, timestamp DESC);

-- Done. Signs table is ready.
