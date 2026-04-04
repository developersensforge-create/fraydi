-- ============================================================
-- Fraydi — Development Seed Data
-- Run after migrations to populate sample data
-- ============================================================
-- NOTE: This seed uses fixed UUIDs for deterministic dev data.
-- Do NOT run in production.

-- ----------------------------------------------------------------
-- Family: The Smiths
-- ----------------------------------------------------------------
insert into families (id, name, invite_code)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'The Smiths',
  'SMITH001'
);

-- ----------------------------------------------------------------
-- Profiles: Mom and Dad
-- (In real usage these would reference auth.users rows)
-- ----------------------------------------------------------------
-- To use this seed, first create two auth users in your Supabase
-- project and replace the UUIDs below with their actual user IDs.
-- For local dev with Supabase CLI, you can use the auth admin API.

insert into profiles (id, family_id, full_name, avatar_url, role, color)
values
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Sarah Smith',
    null,
    'admin',
    '#f96400'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'James Smith',
    null,
    'member',
    '#3b82f6'
  );

-- ----------------------------------------------------------------
-- Calendar Events
-- ----------------------------------------------------------------
insert into calendar_events (
  id, family_id, profile_id, title, description,
  start_time, end_time, location,
  is_child_event, requires_coverage, assigned_to
)
values
  -- Soccer practice (child event, needs coverage)
  (
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Soccer Practice — Emma',
    'Emma''s weekly soccer practice at Riverside Park',
    now() + interval '2 days' + interval '15 hours',
    now() + interval '2 days' + interval '17 hours',
    'Riverside Park, Field 3',
    true,
    true,
    'bbbbbbbb-0000-0000-0000-000000000002'
  ),
  -- School pickup (child event)
  (
    'cccccccc-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'School Pickup — Emma & Noah',
    'Pick up both kids from Lincoln Elementary',
    now() + interval '1 day' + interval '15 hours',
    now() + interval '1 day' + interval '15 hours 30 minutes',
    'Lincoln Elementary School',
    true,
    false,
    'bbbbbbbb-0000-0000-0000-000000000001'
  ),
  -- Date night (family event)
  (
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Date Night 🌙',
    'Dinner at Harvest Table + movie',
    now() + interval '5 days' + interval '18 hours',
    now() + interval '5 days' + interval '23 hours',
    'Harvest Table Restaurant',
    false,
    false,
    null
  );

-- ----------------------------------------------------------------
-- Shopping Items
-- ----------------------------------------------------------------
insert into shopping_items (family_id, added_by, name, category, quantity)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Whole milk', 'Dairy', '1 gallon'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Eggs', 'Dairy', '1 dozen'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Chicken breast', 'Meat', '2 lbs'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Bananas', 'Produce', '1 bunch'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Dishwasher pods', 'Household', '1 box');

-- ----------------------------------------------------------------
-- Todos
-- ----------------------------------------------------------------
insert into todos (family_id, created_by, assigned_to, title, description, due_date)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Schedule pediatrician appointment',
    'Annual checkup for Emma — she''s overdue',
    (current_date + interval '7 days')::date
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Sign permission slip for field trip',
    'Noah''s class trip to the science museum — due Friday',
    (current_date + interval '3 days')::date
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001',
    null,
    'Renew car registration',
    'Both cars expire end of month',
    (current_date + interval '14 days')::date
  );
