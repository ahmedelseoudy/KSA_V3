-- ============================================================
-- KSA CRM — Fix: users_profile RLS Infinite Recursion (BUG-001)
-- Run this in: https://supabase.com/dashboard/project/cbhllxodkfmtgfzeejka/editor
-- ============================================================

-- STEP 1: See what's currently broken (informational)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users_profile';

-- STEP 2: Drop ALL existing policies on users_profile (fixes recursion)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users_profile'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users_profile', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END;
$$;

-- STEP 3: Create clean, non-recursive policies
-- Allow any authenticated user to read their OWN row only (simple uid check, no sub-query)
CREATE POLICY "users_read_own"
ON users_profile
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own row
CREATE POLICY "users_update_own"
ON users_profile
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow service role full access (for admin operations, triggers, etc.)
CREATE POLICY "service_role_full_access"
ON users_profile
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- STEP 4: Verify the admin profile row exists
-- If this returns 0 rows, run STEP 5 below
SELECT id, email, role, status, created_at
FROM users_profile
WHERE email = 'admin@ksa-crm.com';

-- STEP 5 (only if Step 4 returned 0 rows): Create the admin profile
-- First get the user's UUID from auth.users:
-- SELECT id FROM auth.users WHERE email = 'admin@ksa-crm.com';
-- Then run (replacing YOUR_UUID_HERE with the actual UUID):
--
-- INSERT INTO users_profile (id, email, role, status, created_at)
-- VALUES (
--   'YOUR_UUID_HERE',
--   'admin@ksa-crm.com',
--   'super_admin',
--   'approved',
--   NOW()
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'super_admin', status = 'approved';

-- STEP 6: Confirm policies are correct now
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'users_profile';
