import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';

const PUBLIC_ROUTES = ['/login', '/register', '/invite', '/api', '/_astro', '/favicon.ico', '/waiting-approval', '/auth/setup'];

export const onRequest = defineMiddleware(async (context, next) => {
  // Allow public routes to pass through
  if (PUBLIC_ROUTES.some(route => context.url.pathname.startsWith(route))) {
    return next();
  }

  const supabase = createSupabaseServerClient(context.cookies);

  const accessToken = context.cookies.get('sb-access-token');
  const refreshToken = context.cookies.get('sb-refresh-token');

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      refresh_token: refreshToken.value,
      access_token: accessToken.value,
    });
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();

  // Fetch user profile if user exists
  let userWithProfile = user;
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[Middleware] Failed to fetch users_profile for user:', user.id, '| Error:', profileError.message, '| Code:', profileError.code);
    }

    if (profile) {
      userWithProfile = { ...user, profile } as any;
    } else if (!profileError) {
      console.warn('[Middleware] No users_profile row found for user:', user.id, user.email, '- user will be treated as unauthenticated on role-gated pages.');
    }
  }

  context.locals.user = userWithProfile;
  context.locals.session = session;

  if (!user) {
    return context.redirect('/login');
  }

  return next();
});
