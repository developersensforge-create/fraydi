-- Migration 007: Fix coordination_assignments schema
-- Problem: event_id was uuid — Google Calendar event IDs are text strings, not UUIDs
--          assigned_to was uuid FK — needs to hold 'both' | 'none' | profile_id

ALTER TABLE coordination_assignments DROP CONSTRAINT IF EXISTS coordination_assignments_event_id_fkey;
ALTER TABLE coordination_assignments DROP CONSTRAINT IF EXISTS coordination_assignments_assigned_to_fkey;
ALTER TABLE coordination_assignments DROP CONSTRAINT IF EXISTS coordination_assignments_assigned_by_fkey;
ALTER TABLE coordination_assignments DROP CONSTRAINT IF EXISTS coordination_assignments_family_id_fkey;

ALTER TABLE coordination_assignments ALTER COLUMN event_id TYPE text USING event_id::text;
ALTER TABLE coordination_assignments ALTER COLUMN assigned_to TYPE text USING assigned_to::text;

ALTER TABLE coordination_assignments DROP CONSTRAINT IF EXISTS coordination_assignments_event_id_family_id_key;
ALTER TABLE coordination_assignments ADD CONSTRAINT coordination_assignments_event_id_family_id_key UNIQUE (event_id, family_id);

-- RLS
ALTER TABLE coordination_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coordination_assignments_all" ON coordination_assignments;
CREATE POLICY "coordination_assignments_all" ON coordination_assignments FOR ALL USING (true);
