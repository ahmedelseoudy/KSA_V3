import { c as createSupabaseServerClient } from '../../chunks/supabase-server_BsVI-CzH.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';

const POST = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  const body = await request.json();
  const { batch_id, items } = body;
  if (!batch_id || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: "batch_id and items array required" }), { status: 400 });
  }
  const { data: products } = await supabase.from("products").select("id, barcode, company_id, box_quantity, price_per_box").eq("status", "active");
  const productMap = /* @__PURE__ */ new Map();
  for (const p of products || []) {
    productMap.set(p.barcode, p);
  }
  let matched = 0;
  let missing = 0;
  const orderItems = items.map((row) => {
    const barcode = String(row.barcode).replace(/[,\s]/g, "");
    const product = productMap.get(barcode);
    const orderQty = parseInt(row.order_qty) || 0;
    const amazonCost = parseFloat(row.amazon_cost) || 0;
    const amazonCostAfterRebate = amazonCost * 0.95;
    let boxes = 0;
    let providerCost = 0;
    let profitLoss = 0;
    let profitLossPct = 0;
    let companyId = null;
    let productId = null;
    let matchStatus = "missing";
    if (product) {
      matched++;
      matchStatus = "matched";
      productId = product.id;
      companyId = product.company_id;
      boxes = product.box_quantity > 0 ? orderQty / product.box_quantity : 0;
      providerCost = boxes * product.price_per_box;
      profitLoss = amazonCostAfterRebate - providerCost;
      profitLossPct = providerCost !== 0 ? profitLoss / providerCost * 100 : 0;
    } else {
      missing++;
    }
    return {
      batch_id,
      product_id: productId,
      barcode,
      asin: row.asin || null,
      title: row.title || null,
      company_id: companyId,
      order_qty: orderQty,
      boxes: Math.round(boxes * 100) / 100,
      amazon_cost: amazonCost,
      amazon_cost_after_rebate: Math.round(amazonCostAfterRebate * 100) / 100,
      provider_cost: Math.round(providerCost * 100) / 100,
      profit_loss: Math.round(profitLoss * 100) / 100,
      profit_loss_pct: Math.round(profitLossPct * 100) / 100,
      match_status: matchStatus
    };
  });
  let saved = 0;
  const batchSize = 100;
  const errors = [];
  for (let i = 0; i < orderItems.length; i += batchSize) {
    const batch = orderItems.slice(i, i + batchSize);
    const { data, error } = await supabase.from("order_items").insert(batch).select();
    if (error) {
      errors.push(error.message);
    } else {
      saved += data?.length || 0;
    }
  }
  const totalValue = orderItems.reduce((sum, item) => sum + (item.provider_cost || 0), 0);
  await supabase.from("order_batches").update({ total_items: saved, total_value: totalValue }).eq("id", batch_id);
  return new Response(JSON.stringify({ saved, matched, missing, errors }), {
    headers: { "Content-Type": "application/json" }
  });
};
const DELETE = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400 });
  const { error } = await supabase.from("order_items").delete().eq("id", id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
