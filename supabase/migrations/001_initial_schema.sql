-- ============================================================
-- Fraydi — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ----------------------------------------------------------------
-- families: the top-level group
-- ----------------------------------------------------------------
create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now(),
  invite_code text unique default substring(gen_random_uuid()::text, 1, 8)
);

alter table families enable row level security;

-- Any authenticated user can read a family they belong to (joined via profiles)
create policy "family members can read their family"
  on families for select
  using (
    id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- Only family admins can update family info
create policy "admins can update family"
  on families for update
  using (
    id in (
      select family_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- profiles: family members (linked to Supabase auth)
-- ----------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  family_id   uuid references families(id) on delete set null,
  full_name   text,
  avatar_url  text,
  role        text default 'member',  -- 'admin' | 'member'
  color       text default '#f96400', -- color for calendar display
  created_at  timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read all profiles in their family
create policy "family members can read profiles"
  on profiles for select
  using (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- Users can only update their own profile
create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- Users can insert their own profile (on signup)
create policy "users can insert own profile"
  on profiles for insert
  with check (id = auth.uid());

-- ----------------------------------------------------------------
-- calendar_events: synced from Google Calendar
-- ----------------------------------------------------------------
create table calendar_events (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid references families(id) on delete cascade,
  profile_id           uuid references profiles(id) on delete cascade,
  google_event_id      text,
  title                text not null,
  description          text,
  start_time           timestamptz not null,
  end_time             timestamptz not null,
  location             text,
  is_child_event       boolean default false,
  requires_coverage    boolean default false,
  assigned_to          uuid references profiles(id),
  assignment_confirmed boolean default false,
  created_at           timestamptz default now()
);

alter table calendar_events enable row level security;

-- Family members can read all events in their family
create policy "family members can read events"
  on calendar_events for select
  using (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- Users can insert events for their family
create policy "users can insert own events"
  on calendar_events for insert
  with check (
    profile_id = auth.uid()
    and family_id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- Users can update their own events
create policy "users can update own events"
  on calendar_events for update
  using (profile_id = auth.uid());

-- Users can delete their own events
create policy "users can delete own events"
  on calendar_events for delete
  using (profile_id = auth.uid());

-- ----------------------------------------------------------------
-- shopping_items: shared family shopping list
-- ----------------------------------------------------------------
create table shopping_items (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid references families(id) on delete cascade,
  added_by   uuid references profiles(id),
  name       text not null,
  category   text,
  quantity   text,
  is_checked boolean default false,
  created_at timestamptz default now()
);

alter table shopping_items enable row level security;

-- All family members can read/insert/update/delete shopping items
create policy "family members full access to shopping items"
  on shopping_items for all
  using (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  )
  with check (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- todos: shared family to-do list
-- ----------------------------------------------------------------
create table todos (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references families(id) on delete cascade,
  created_by  uuid references profiles(id),
  assigned_to uuid references profiles(id),
  title       text not null,
  description text,
  due_date    date,
  is_done     boolean default false,
  created_at  timestamptz default now()
);

alter table todos enable row level security;

-- All family members can read/insert/update/delete todos
create policy "family members full access to todos"
  on todos for all
  using (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  )
  with check (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- coordination_assignments: who is covering a child event
-- ----------------------------------------------------------------
create table coordination_assignments (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references calendar_events(id) on delete cascade,
  family_id    uuid references families(id) on delete cascade,
  assigned_to  uuid references profiles(id),
  assigned_by  uuid references profiles(id),
  status       text default 'pending', -- 'pending' | 'confirmed' | 'declined'
  notified_at  timestamptz,
  confirmed_at timestamptz,
  created_at   timestamptz default now()
);

alter table coordination_assignments enable row level security;

-- All family members can read coordination assignments
create policy "family members can read assignments"
  on coordination_assignments for select
  using (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- Family members can insert assignments (e.g., admins assigning tasks)
create policy "family members can insert assignments"
  on coordination_assignments for insert
  with check (
    family_id in (
      select family_id from profiles where id = auth.uid()
    )
  );

-- Users can update their own assignment (confirm/decline)
create policy "users can update own assignments"
  on coordination_assignments for update
  using (assigned_to = auth.uid());
