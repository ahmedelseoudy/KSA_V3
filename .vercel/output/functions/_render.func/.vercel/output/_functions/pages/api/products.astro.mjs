import { c as createSupabaseServerClient } from '../../chunks/supabase-server_BsVI-CzH.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';

const GET = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const company_id = url.searchParams.get("company_id") || "";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  let query = supabase.from("products").select("*, company:companies(id, name)", { count: "exact" }).eq("status", "active").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (search) {
    query = query.or(`barcode.ilike.%${search}%,title.ilike.%${search}%,asin.ilike.%${search}%`);
  }
  if (company_id) {
    query = query.eq("company_id", company_id);
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
  if (body.bulk && Array.isArray(body.products)) {
    const products = body.products;
    const companyNames = [...new Set(products.map((p) => p.company).filter(Boolean))];
    const { data: existingCompanies } = await supabase.from("companies").select("id, name").in("name", companyNames);
    const companyMap = /* @__PURE__ */ new Map();
    for (const c of existingCompanies || []) {
      companyMap.set(c.name, c.id);
    }
    const missingNames = companyNames.filter((n) => !companyMap.has(n));
    if (missingNames.length > 0) {
      const { data: created2 } = await supabase.from("companies").insert(missingNames.map((name) => ({ name }))).select("id, name");
      for (const c of created2 || []) {
        companyMap.set(c.name, c.id);
      }
    }
    const upsertData = products.map((p) => ({
      barcode: String(p.barcode).replace(/[,\s]/g, ""),
      asin: p.asin || null,
      title: p.title || null,
      company_id: companyMap.get(p.company) || null,
      box_quantity: parseInt(p.box_quantity) || 1,
      price_per_box: parseFloat(p.price_per_box) || 0,
      category: p.category || null
    }));
    let created = 0;
    const errors = [];
    const batchSize = 100;
    for (let i = 0; i < upsertData.length; i += batchSize) {
      const batch = upsertData.slice(i, i + batchSize);
      const { data, error } = await supabase.from("products").upsert(batch, { onConflict: "barcode" }).select();
      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        created += data?.length || 0;
      }
    }
    return new Response(JSON.stringify({ created, errors }), {
      headers: { "Content-Type": "application/json" }
    });
  } else {
    const { data, error } = await supabase.from("products").insert({
      barcode: body.barcode,
      asin: body.asin || null,
      title: body.title || null,
      company_id: body.company_id || null,
      box_quantity: body.box_quantity || 1,
      price_per_box: body.price_per_box || 0,
      category: body.category || null
    }).select("*, company:companies(id, name)").single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
