import { c as createSupabaseServerClient } from '../../../chunks/supabase-server_BsVI-CzH.mjs';
export { g as renderers } from '../../../chunks/vendor_LCkWoqkp.mjs';

const POST = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const body = await request.json();
  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Token required" }), { status: 400 });
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400 });
  }
  const { error } = await supabase.rpc("complete_password_setup", {
    p_token: token,
    p_new_password: password
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
