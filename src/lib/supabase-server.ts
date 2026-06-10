import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY environment variables');
}

// Creates a basic Supabase client with cookie-based storage.
// NOTE: The SDK's storage adapter uses keys like "sb-[ref]-auth-token",
// but the login API stores tokens as "sb-access-token" / "sb-refresh-token".
// Use createAuthenticatedClient() for API routes that need auth.
export const createSupabaseServerClient = (cookies: AstroCookies): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key) => cookies.get(key)?.value ?? null,
        setItem: (key, value) => cookies.set(key, value, { path: '/', httpOnly: true, sameSite: 'lax' }),
        removeItem: (key) => cookies.delete(key, { path: '/' }),
      },
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
};

/**
 * Creates a Supabase client AND restores the session from the
 * sb-access-token / sb-refresh-token cookies set by the login API.
 * Use this in ALL API route handlers that require authentication.
 */
export const createAuthenticatedClient = async (cookies: AstroCookies): Promise<SupabaseClient> => {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return supabase;
};
