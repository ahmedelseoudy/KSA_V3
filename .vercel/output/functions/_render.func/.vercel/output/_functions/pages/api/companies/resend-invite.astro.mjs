import { c as createSupabaseServerClient } from '../../../chunks/supabase-server_BsVI-CzH.mjs';
import { c as companyInviteEmail, s as sendEmail, P as PUBLIC_APP_URL } from '../../../chunks/email-templates_CPs1kHmY.mjs';
export { g as renderers } from '../../../chunks/vendor_LCkWoqkp.mjs';

const POST = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  const { company_id } = await request.json();
  if (!company_id) {
    return new Response(JSON.stringify({ error: "company_id required" }), { status: 400 });
  }
  const { data: company, error: companyErr } = await supabase.from("companies").select("id, name, email, additional_emails, user_id").eq("id", company_id).single();
  if (companyErr || !company) {
    return new Response(JSON.stringify({ error: "Company not found" }), { status: 404 });
  }
  if (!company.user_id) {
    return new Response(JSON.stringify({ error: "Company has no linked user. Add an email and create the company first." }), { status: 400 });
  }
  if (!company.email) {
    return new Response(JSON.stringify({ error: "Company has no primary email" }), { status: 400 });
  }
  const { data: token, error: rpcErr } = await supabase.rpc("regenerate_setup_token", {
    p_user_id: company.user_id
  });
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), { status: 400 });
  }
  const setupUrl = `${PUBLIC_APP_URL}/auth/setup?token=${encodeURIComponent(token)}`;
  const { subject, html } = companyInviteEmail({
    company_name: company.name,
    setup_url: setupUrl
  });
  const allRecipients = Array.from(
    /* @__PURE__ */ new Set([company.email, ...company.additional_emails || []])
  ).filter(Boolean);
  const emailResp = await sendEmail({ to: allRecipients, subject, html });
  return new Response(JSON.stringify({ sent: emailResp.ok, error: emailResp.error }), {
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
