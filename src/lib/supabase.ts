import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://cbhllxodkfmtgfzeejka.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGxseG9ka2ZtdGdmemVlamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODI0MzIsImV4cCI6MjA5NTM1ODQzMn0.Wp9416pCpPvA6sZd7DvMvWUGJpkhIyOJmQ2pfZgw3wU';
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Fallback values for build time - these are public keys so it's safe
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Using fallback Supabase configuration');
}

// Client for browser-side operations (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Database types for TypeScript
export interface UserProfile {
  id: string;
  role: 'super_admin' | 'admin' | 'user';
  status: 'pending' | 'approved' | 'suspended';
  email: string;
  invited_by?: string;
  approved_by?: string;
  created_at: string;
  approved_at?: string;
}

export interface Invitation {
  id: string;
  email: string;
  invite_code: string;
  created_by: string;
  expires_at: string;
  used_at?: string;
  used_by?: string;
}

export interface PagePermission {
  id: string;
  page_path: string;
  min_required_role: 'user' | 'admin' | 'super_admin';
  created_at: string;
  updated_by: string;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action_type: string;
  target_user?: string;
  details: Record<string, any>;
  timestamp: string;
}
