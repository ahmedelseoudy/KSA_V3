import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY environment variables');
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
