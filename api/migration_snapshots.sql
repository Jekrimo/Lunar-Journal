-- Add snapshots column to entries table for tracking intra-day energy timeline
-- Run this in Supabase Dashboard → SQL Editor → New Query

ALTER TABLE entries ADD COLUMN IF NOT EXISTS snapshots jsonb DEFAULT '[]';

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'entries' AND column_name = 'snapshots';
