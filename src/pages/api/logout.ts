import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase-server';

export const POST: APIRoute = async ({ cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  try {
    // Best-effort sign out from Supabase auth
    await supabase.auth.signOut();
  } catch {}

  // Clear httpOnly cookies set by our login flow
  try {
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
  } catch {}

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
