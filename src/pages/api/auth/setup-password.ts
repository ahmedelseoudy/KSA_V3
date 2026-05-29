import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const body = await request.json();
  const token = String(body.token || '').trim();
  const password = String(body.password || '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Token required' }), { status: 400 });
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400 });
  }

  const { error } = await supabase.rpc('complete_password_setup', {
    p_token: token,
    p_new_password: password,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
