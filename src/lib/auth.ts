import { supabase, supabaseAdmin, type UserProfile } from './supabase';
import type { User } from '@supabase/supabase-js';

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
  'super_admin': 3,
  'admin': 2,
  'user': 1,
  'company': 1
} as const;

// Get current authenticated user with profile
export async function getCurrentUser(): Promise<(User & { profile?: UserProfile }) | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      ...user,
      profile,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Login user with email and password
export async function login(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    // Check if user profile exists and is approved
    if (data.user) {
      const { data: profile } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      return {
        user: data.user,
        profile,
        session: data.session
      };
    }

    throw new Error('Login failed');
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Alias for backward compatibility
export const loginUser = login;

// Logout user
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}

// Register user with invite code (replaces registerCompany)
export async function registerWithInvite(
  email: string, 
  password: string, 
  inviteCode: string,
  fullName?: string
) {
  try {
    // Verify invite code first
    const { data: invitation } = await supabase
      .from('invitations')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('email', email)
      .single();

    if (!invitation) {
      throw new Error('Invalid invite code');
    }

    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('Invite code has expired');
    }

    if (invitation.used_at) {
      throw new Error('Invite code has already been used');
    }

    // Create user account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0]
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      // Create user profile
      const { error: profileError } = await supabase
        .from('users_profile')
        .insert({
          id: data.user.id,
          email: email,
          role: 'user',
          status: 'pending',
          invited_by: invitation.created_by
        });

      if (profileError) throw profileError;

      // Mark invitation as used
      await supabase
        .from('invitations')
        .update({
          used_at: new Date().toISOString(),
          used_by: data.user.id
        })
        .eq('id', invitation.id);

      // Send notification to admins (handled by Supabase triggers)
      
      return {
        user: data.user,
        session: data.session
      };
    }

    throw new Error('Registration failed');
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Check if user has required permission level
export function hasPermission(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0;
  
  return userLevel >= requiredLevel;
}

// Check if user can access a specific page
export async function canAccessPage(userRole: string, pagePath: string): Promise<boolean> {
  try {
    // Get page permission
    const { data: permission } = await supabase
      .from('page_permissions')
      .select('min_required_role')
      .eq('page_path', pagePath)
      .single();

    // If page not registered, default to admin-only (secure by default)
    const requiredRole = permission?.min_required_role || 'admin';
    
    return hasPermission(userRole, requiredRole);
  } catch (error) {
    // If error fetching permissions, default to admin-only for security
    return hasPermission(userRole, 'admin');
  }
}

// Generate invite code (admin function)
export async function generateInvite(email: string, createdBy: string): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }

  try {
    // Generate unique invite code
    const inviteCode = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const { data, error } = await supabaseAdmin
      .from('invitations')
      .insert({
        email,
        invite_code: inviteCode,
        created_by: createdBy,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return inviteCode;
  } catch (error) {
    console.error('Error generating invite:', error);
    throw error;
  }
}
