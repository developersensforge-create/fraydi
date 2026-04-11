-- Add price and tags fields to watch_events
ALTER TABLE watch_events ADD COLUMN IF NOT EXISTS price TEXT;
ALTER TABLE watch_events ADD COLUMN IF NOT EXISTS tags TEXT[];
