import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase-server';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(cookies);
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return new Response('Email and password are required', { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    const errorMessage = error ? error.message : 'No session returned on login.';
    if (errorMessage.includes('Invalid login credentials')) {
      return redirect('/login?error=invalid');
    }
    return redirect(`/login?error=general&message=${encodeURIComponent(errorMessage)}`);
  }

  const { access_token, refresh_token } = data.session;

  // Set cookies for the server-side client
  cookies.set('sb-access-token', access_token, { path: '/', httpOnly: true, sameSite: 'lax' });
  cookies.set('sb-refresh-token', refresh_token, { path: '/', httpOnly: true, sameSite: 'lax' });

  return redirect('/dashboard');
};
