-- STEP 1: Drop ALL broken RLS policies on users_profile
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users_profile'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users_profile', pol.policyname);
    RAISE NOTICE 'Dropped: %', pol.policyname;
  END LOOP;
END;
$$;

-- STEP 2: Disable RLS entirely (the app uses middleware for access control anyway)
ALTER TABLE users_profile DISABLE ROW LEVEL SECURITY;

-- STEP 3: Ensure admin profile exists with correct role
INSERT INTO users_profile (id, email, role, status, created_at)
VALUES (
  '4f55e57e-4af2-4471-a3a8-dbb8fc91925b',
  'admin@ksa-crm.com',
  'super_admin',
  'approved',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET 
  role = 'super_admin', 
  status = 'approved',
  email = 'admin@ksa-crm.com';

-- STEP 4: Verify
SELECT id, email, role, status FROM users_profile WHERE email = 'admin@ksa-crm.com';