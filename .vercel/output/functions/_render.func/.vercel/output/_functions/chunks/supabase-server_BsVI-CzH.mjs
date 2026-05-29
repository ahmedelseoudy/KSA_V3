import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cbhllxodkfmtgfzeejka.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGxseG9ka2ZtdGdmemVlamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODI0MzIsImV4cCI6MjA5NTM1ODQzMn0.Wp9416pCpPvA6sZd7DvMvWUGJpkhIyOJmQ2pfZgw3wU";
const createSupabaseServerClient = (cookies) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key) => cookies.get(key)?.value ?? null,
        setItem: (key, value) => cookies.set(key, value, { path: "/", httpOnly: true, sameSite: "lax" }),
        removeItem: (key) => cookies.delete(key, { path: "/" })
      },
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
};

export { createSupabaseServerClient as c };
