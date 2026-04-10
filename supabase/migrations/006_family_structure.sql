-- ============================================================
-- Fraydi — Family Structure: children, updated members, invite flow
-- Migration: 006_family_structure.sql
-- ============================================================

-- ----------------------------------------------------------------
-- family_children: kids within a family (new dedicated table)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  grade INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_children ENABLE ROW LEVEL SECURITY;

-- Drop and recreate to avoid duplicates
DROP POLICY IF EXISTS "family_children_all" ON family_children;
CREATE POLICY "family_children_all" ON family_children FOR ALL USING (true);

-- ----------------------------------------------------------------
-- family_members: add new columns for invite / access tracking
-- ----------------------------------------------------------------
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS is_account_holder BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'pending'
    CHECK (invite_status IN ('pending','accepted','declined','not_invited')),
  ADD COLUMN IF NOT EXISTS calendar_access TEXT DEFAULT 'none'
    CHECK (calendar_access IN ('full','busy_only','none')),
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;

-- Drop and re-add role constraint to include new valid values
ALTER TABLE family_members DROP CONSTRAINT IF EXISTS family_members_role_check;
ALTER TABLE family_members ADD CONSTRAINT family_members_role_check
  CHECK (role IN ('me','spouse','co-parent','grandparent','caregiver','kid','other'));

-- Enable RLS and default permissive policy
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_members_all" ON family_members;
CREATE POLICY "family_members_all" ON family_members FOR ALL USING (true);

-- ----------------------------------------------------------------
-- member_child_links: link family members to children
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_child_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  child_id UUID REFERENCES family_children(id) ON DELETE CASCADE,
  UNIQUE(family_member_id, child_id)
);

ALTER TABLE member_child_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_child_links_all" ON member_child_links;
CREATE POLICY "member_child_links_all" ON member_child_links FOR ALL USING (true);
