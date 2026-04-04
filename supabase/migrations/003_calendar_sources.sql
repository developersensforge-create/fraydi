-- Migration: 003_calendar_sources
-- Adds the calendar_sources table for storing iCal feed URLs per family

create table calendar_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  family_id uuid references families(id) on delete cascade,
  name text not null,           -- "Work Calendar", "School Calendar"
  ical_url text not null,       -- the private sync URL
  color text default '#f96400',
  last_synced_at timestamptz,
  event_count int default 0,
  created_at timestamptz default now()
);

alter table calendar_sources enable row level security;

create policy "family members can read" on calendar_sources
  for select using (
    family_id in (select family_id from profiles where id = auth.uid())
  );

create policy "owner can manage" on calendar_sources
  for all using (profile_id = auth.uid());
