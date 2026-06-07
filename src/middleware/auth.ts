import { createSupabaseServerClient } from '../lib/supabase-server';
import type { APIContext, MiddlewareHandler } from 'astro';

const PUBLIC_ROUTES = ['/login', '/_astro', '/favicon.ico'];
const PENDING_ROUTES = ['/waiting-approval', '/login', '/logout'];

export async function authMiddleware(context: APIContext, next: () => Promise<Response>) {
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

  // Store user and session in context for pages to access
  context.locals.user = user;
  context.locals.session = session;

  const { url, redirect } = context;
  const path = url.pathname;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
    return next();
  }

  // If no user, redirect to login
  if (!user) {
    return redirect('/login');
  }

  // You can add profile/role checks here if needed in the future
  // For now, we just ensure the user is authenticated.

  return next();
}

// Helper function to register page permissions
export const registerPagePermission: MiddlewareHandler = async (context, next) => {
  const pagePath = context.url.pathname;
  const minRequiredRole = 'admin'; // Default to admin

  try {
    const { supabase } = await import('../lib/supabase');
    
    // Check if permission already exists
    const { data: existing } = await supabase
      .from('page_permissions')
      .select('id')
      .eq('page_path', pagePath)
      .single();

    if (!existing) {
      // Create new permission with secure default
      await supabase
        .from('page_permissions')
        .insert({
          page_path: pagePath,
          min_required_role: minRequiredRole,
          updated_by: 'system'
        });
    }
  } catch (error) {
    console.error('Error registering page permission:', error);
  }

  // Continue to the next middleware
  return next();
};