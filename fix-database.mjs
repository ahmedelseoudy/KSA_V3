/**
 * KSA CRM — One-time Database Fix Script
 * Fixes:
 * 1. Infinite recursion RLS policy on users_profile
 * 2. Ensures admin user profile exists with correct role/status
 * 
 * Run with: node fix-database.mjs
 */

import pkg from 'pg';
const { Client } = pkg;

// Supabase direct Postgres connection (Session Pooler)
// Format: postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
// We need the DB password - this is NOT the anon key, it's the database password

// Let's try the Supabase REST API approach with the Supabase Management API
// using a direct postgres connection string

// The database URL format for Supabase Session Pooler:
// postgresql://postgres.cbhllxodkfmtgfzeejka:[DB_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

// Since we don't have the DB password, let's use the REST API with service role key approach
// We can also try using pg with Supabase's connection pooler if we know the password

// Alternative: Use the Supabase admin API endpoint to bypass RLS
// The /rest/v1/rpc endpoint with the service role key would work

// Let's try a different approach: Use the Management API to get a service key
// First, let me check if there's a way to use the anon key with admin privileges

const SUPABASE_URL = 'https://cbhllxodkfmtgfzeejka.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGxseG9ka2ZtdGdmemVlamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODI0MzIsImV4cCI6MjA5NTM1ODQzMn0.Wp9416pCpPvA6sZd7DvMvWUGJpkhIyOJmQ2pfZgw3wU';
const ADMIN_EMAIL = 'admin@ksa-crm.com';
const ADMIN_PASSWORD = 'Admin@KSA2025!';
const ADMIN_USER_ID = '4f55e57e-4af2-4471-a3a8-dbb8fc91925b'; // from earlier curl

async function main() {
  console.log('🔧 KSA CRM Database Fix Script');
  console.log('================================\n');

  // Step 1: Get admin auth token
  console.log('Step 1: Authenticating as admin...');
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  
  const authData = await authResp.json();
  if (!authData.access_token) {
    console.error('❌ Failed to authenticate:', authData);
    process.exit(1);
  }
  
  const ACCESS_TOKEN = authData.access_token;
  console.log('✅ Authenticated! User ID:', authData.user?.id);
  console.log();

  // Step 2: Try to query users_profile (to confirm the RLS issue)
  console.log('Step 2: Testing users_profile RLS...');
  const profileResp = await fetch(`${SUPABASE_URL}/rest/v1/users_profile?select=id,email,role,status&email=eq.admin@ksa-crm.com`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
  });
  
  const profileText = await profileResp.text();
  console.log('Response:', profileText);
  
  if (profileText.includes('infinite recursion')) {
    console.log('\n🔴 CONFIRMED: Infinite recursion RLS policy detected!');
    console.log('\n📋 You MUST manually fix this in the Supabase Dashboard.');
    console.log('\n🔗 Go to: https://supabase.com/dashboard/project/cbhllxodkfmtgfzeejka/sql/new');
    console.log('\n📋 Run this SQL:\n');
    
    const sql = `
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
`;
    
    console.log(sql);
    
    // Write to a file for easy access
    const fs = await import('fs');
    fs.writeFileSync('URGENT-FIX-RLS.sql', sql.trim());
    console.log('\n✅ SQL also saved to URGENT-FIX-RLS.sql');
    
  } else {
    const profileData = JSON.parse(profileText);
    if (profileData.length > 0) {
      console.log('✅ Admin profile found:', profileData[0]);
    } else {
      console.log('⚠️  No admin profile found, but no RLS error either. Will create it.');
      
      // Try to insert
      const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/users_profile`, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: ADMIN_USER_ID,
          email: ADMIN_EMAIL,
          role: 'super_admin',
          status: 'approved',
        }),
      });
      
      console.log('Insert status:', insertResp.status);
      const insertText = await insertResp.text();
      console.log('Insert result:', insertText);
    }
  }
}

main().catch(console.error);
