import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// ONE-TIME FIX ENDPOINT — DELETE THIS FILE AFTER USE
// This endpoint fixes the infinite recursion RLS policy on users_profile
// Only callable from localhost for security

export const GET: APIRoute = async ({ request, url }) => {
  // Security: only allow from localhost
  const host = request.headers.get('host') || '';
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    return new Response('Forbidden', { status: 403 });
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://cbhllxodkfmtgfzeejka.supabase.co';
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
  
  const results: string[] = [];

  // Step 1: Try to login as admin to get a session with admin privileges
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Try to authenticate to get a session
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'admin@ksa-crm.com',
    password: 'Admin@KSA2025!'
  });

  if (authError) {
    results.push(`Auth error: ${authError.message}`);
    // Try to proceed anyway — maybe the session will let us query auth.users
  } else {
    results.push(`Logged in as: ${authData.user?.email}`);
  }

  // Step 2: Check if we can query users_profile at all
  const { data: profileCheck, error: profileCheckError } = await client
    .from('users_profile')
    .select('id, email, role, status')
    .eq('email', 'admin@ksa-crm.com')
    .single();

  if (profileCheckError) {
    results.push(`users_profile query error: ${profileCheckError.message} (code: ${profileCheckError.code})`);
    
    if (profileCheckError.code === '42P17') {
      results.push('CONFIRMED: Infinite recursion RLS policy detected!');
      results.push('');
      results.push('=== ACTION REQUIRED ===');
      results.push('You must run the following SQL in the Supabase SQL Editor:');
      results.push('URL: https://supabase.com/dashboard/project/cbhllxodkfmtgfzeejka/sql/new');
      results.push('');
      results.push('SQL to run:');
      results.push(`
-- Drop ALL existing policies on users_profile (fixes the infinite recursion)
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

-- Disable RLS entirely for now (re-enable later with correct policies)
ALTER TABLE users_profile DISABLE ROW LEVEL SECURITY;

-- Or alternatively, create simple non-recursive policies:
-- ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_all_authenticated" ON users_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "allow_service_role" ON users_profile FOR ALL TO service_role USING (true) WITH CHECK (true);
      `);
    }
  } else {
    results.push(`Admin profile found: ${JSON.stringify(profileCheck)}`);
  }

  // Step 3: Try to check auth.users via signUp (this won't work but let us see)
  results.push('');
  results.push('=== CURRENT SESSION INFO ===');
  results.push(`User ID: ${authData?.user?.id || 'none'}`);
  results.push(`User Email: ${authData?.user?.email || 'none'}`);
  results.push(`Session: ${authData?.session ? 'active' : 'none'}`);

  const html = `<!DOCTYPE html>
<html>
<head><title>RLS Fix Tool</title><style>
body { font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 2rem; }
pre { background: #0a0a0a; padding: 1rem; border: 1px solid #333; white-space: pre-wrap; }
h1 { color: #ff6b6b; }
.success { color: #00ff00; }
.error { color: #ff4444; }
.info { color: #4499ff; }
</style></head>
<body>
<h1>🔧 KSA CRM — RLS Fix Diagnostics</h1>
<pre>${results.join('\n')}</pre>

<h2 style="color:#ffaa00">Instructions to fix manually:</h2>
<ol style="color:#ccc; line-height:2">
  <li>Go to: <a href="https://supabase.com/dashboard/project/cbhllxodkfmtgfzeejka/sql/new" style="color:#4499ff" target="_blank">Supabase SQL Editor</a></li>
  <li>Log in to your Supabase account</li>
  <li>Paste and run this SQL:</li>
</ol>
<pre style="color:#ffdd00">
-- STEP 1: Drop all broken RLS policies
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users_profile'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users_profile', pol.policyname);
  END LOOP;
END;
$$;

-- STEP 2: Disable RLS temporarily (simplest fix)
ALTER TABLE users_profile DISABLE ROW LEVEL SECURITY;

-- STEP 3: Verify admin profile exists
SELECT id, email, role, status FROM users_profile WHERE email = 'admin@ksa-crm.com';

-- STEP 4: If Step 3 returned nothing, run this to create the admin profile:
INSERT INTO users_profile (id, email, role, status, created_at)
SELECT id, email, 'super_admin', 'approved', NOW()
FROM auth.users
WHERE email = 'admin@ksa-crm.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', status = 'approved';
</pre>

<p style="color:#888">After running the SQL, the login at <a href="http://localhost:4321/login" style="color:#4499ff">http://localhost:4321/login</a> should work.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
};
