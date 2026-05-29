import { c as createSupabaseServerClient } from '../../chunks/supabase-server_BsVI-CzH.mjs';
import { c as companyInviteEmail, s as sendEmail, P as PUBLIC_APP_URL } from '../../chunks/email-templates_CPs1kHmY.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';

const GET = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  let query = supabase.from("companies").select("*", { count: "exact" }).order("name");
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,contact_person.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data, count }), {
    headers: { "Content-Type": "application/json" }
  });
};
const POST = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  const body = await request.json();
  const primaryEmail = body.email ? String(body.email).trim().toLowerCase() : null;
  const additionalEmails = Array.isArray(body.additional_emails) ? body.additional_emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [];
  if (!body.name || typeof body.name !== "string") {
    return new Response(JSON.stringify({ error: "Company name is required" }), { status: 400 });
  }
  const { data: company, error: companyErr } = await supabase.from("companies").insert({
    name: body.name,
    email: primaryEmail,
    additional_emails: additionalEmails,
    phone: body.phone || null,
    address: body.address || null,
    contact_person: body.contact_person || null
  }).select().single();
  if (companyErr) {
    return new Response(JSON.stringify({ error: companyErr.message }), { status: 400 });
  }
  let inviteResult = { sent: false };
  if (primaryEmail) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("create_company_user", {
      p_email: primaryEmail,
      p_company_id: company.id
    });
    if (rpcErr) {
      inviteResult = { sent: false, error: rpcErr.message };
    } else {
      const setupToken = Array.isArray(rpcData) ? rpcData[0]?.setup_token : rpcData?.setup_token;
      const setupUrl = `${PUBLIC_APP_URL}/auth/setup?token=${encodeURIComponent(setupToken)}`;
      const { subject, html } = companyInviteEmail({
        company_name: company.name,
        setup_url: setupUrl
      });
      const allRecipients = Array.from(/* @__PURE__ */ new Set([primaryEmail, ...additionalEmails])).filter(Boolean);
      const emailResp = await sendEmail({ to: allRecipients, subject, html });
      inviteResult = { sent: emailResp.ok, error: emailResp.error };
    }
  }
  return new Response(JSON.stringify({ company, invite: inviteResult }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
};
const PUT = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400 });
  const { data, error } = await supabase.from("companies").update(updates).eq("id", id).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
};
const DELETE = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400 });
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE,
  GET,
  POST,
  PUT
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
