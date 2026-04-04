-- ============================================================
-- Fraydi — Google Calendar OAuth Tokens
-- Migration: 002_google_calendar_tokens.sql
-- ============================================================

create table google_calendar_tokens (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles(id) on delete cascade unique,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS: only the owner can access their own tokens
alter table google_calendar_tokens enable row level security;

create policy "own tokens only"
  on google_calendar_tokens for all
  using (profile_id = auth.uid());

-- Auto-update updated_at on row changes
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger google_calendar_tokens_updated_at
  before update on google_calendar_tokens
  for each row execute function update_updated_at_column();
