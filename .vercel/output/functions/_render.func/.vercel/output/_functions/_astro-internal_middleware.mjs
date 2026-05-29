import { i as defineMiddleware, j as sequence } from './chunks/vendor_LCkWoqkp.mjs';
import { c as createSupabaseServerClient } from './chunks/supabase-server_BsVI-CzH.mjs';
import 'es-module-lexer';
import 'cookie';

const PUBLIC_ROUTES = ["/login", "/register", "/invite", "/api", "/_astro", "/favicon.ico", "/waiting-approval", "/auth/setup"];
const onRequest$1 = defineMiddleware(async (context, next) => {
  if (PUBLIC_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    return next();
  }
  const supabase = createSupabaseServerClient(context.cookies);
  const accessToken = context.cookies.get("sb-access-token");
  const refreshToken = context.cookies.get("sb-refresh-token");
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      refresh_token: refreshToken.value,
      access_token: accessToken.value
    });
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  let userWithProfile = user;
  if (user) {
    const { data: profile } = await supabase.from("users_profile").select("*").eq("id", user.id).single();
    if (profile) {
      userWithProfile = { ...user, profile };
    }
  }
  context.locals.user = userWithProfile;
  context.locals.session = session;
  if (!user) {
    return context.redirect("/login");
  }
  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
