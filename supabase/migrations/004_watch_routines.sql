-- Migration 004: Watch/Interest List + Family Routines
-- Apply via Supabase dashboard SQL editor or: supabase db push

-- Watch/Interest List Sources
CREATE TABLE IF NOT EXISTS watch_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ical_url', 'manual')),
  url TEXT,
  color TEXT DEFAULT '#6366f1',
  active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Watch/Interest Events (from watch sources or manual)
CREATE TABLE IF NOT EXISTS watch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  source_id UUID REFERENCES watch_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  url TEXT,
  interest_level TEXT DEFAULT 'watch' CHECK (interest_level IN ('watch', 'interested', 'hot')),
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Family Routines
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
  days_of_week INTEGER[] DEFAULT '{}',  -- 0=Sun, 1=Mon, ..., 6=Sat; for monthly: day-of-month numbers
  time_of_day TIME,
  reminder_minutes_before INTEGER DEFAULT 30,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE watch_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_watch_sources" ON watch_sources FOR ALL USING (true);
CREATE POLICY "family_watch_events" ON watch_events FOR ALL USING (true);
CREATE POLICY "family_routines" ON routines FOR ALL USING (true);
