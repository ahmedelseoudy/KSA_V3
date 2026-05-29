import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cbhllxodkfmtgfzeejka.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGxseG9ka2ZtdGdmemVlamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODI0MzIsImV4cCI6MjA5NTM1ODQzMn0.Wp9416pCpPvA6sZd7DvMvWUGJpkhIyOJmQ2pfZgw3wU";
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : void 0
  }
});

export { supabase };
