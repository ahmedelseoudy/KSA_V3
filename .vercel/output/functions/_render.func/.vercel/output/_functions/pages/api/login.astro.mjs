import { c as createSupabaseServerClient } from '../../chunks/supabase-server_BsVI-CzH.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';

const POST = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(cookies);
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  if (!email || !password) {
    return new Response("Email and password are required", { status: 400 });
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error || !data.session) {
    const errorMessage = error ? error.message : "No session returned on login.";
    if (errorMessage.includes("Invalid login credentials")) {
      return redirect("/login?error=invalid");
    }
    return redirect(`/login?error=general&message=${encodeURIComponent(errorMessage)}`);
  }
  const { access_token, refresh_token } = data.session;
  cookies.set("sb-access-token", access_token, { path: "/", httpOnly: true, sameSite: "lax" });
  cookies.set("sb-refresh-token", refresh_token, { path: "/", httpOnly: true, sameSite: "lax" });
  return redirect("/dashboard");
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
