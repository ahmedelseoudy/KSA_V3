import { c as createSupabaseServerClient } from '../../chunks/supabase-server_BsVI-CzH.mjs';
import { s as sendAvailabilityRequestEmail } from '../../chunks/notifications_BnWJkShD.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';

const GET = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  const url = new URL(request.url);
  const batch_id = url.searchParams.get("batch_id") || "";
  const availability_order_id = url.searchParams.get("id") || "";
  if (availability_order_id) {
    const { data: data2, error: error2 } = await supabase.from("availability_responses").select("*, order_item:order_items(id, barcode, asin, title, order_qty, boxes, provider_cost)").eq("availability_order_id", availability_order_id);
    if (error2) return new Response(JSON.stringify({ error: error2.message }), { status: 500 });
    return new Response(JSON.stringify({ data: data2 }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  let query = supabase.from("availability_orders").select("*, company:companies(id, name, email)").order("created_at", { ascending: false });
  if (batch_id) {
    query = query.eq("batch_id", batch_id);
  }
  if (profile?.role === "company") {
    const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).single();
    if (company) {
      query = query.eq("company_id", company.id);
    } else {
      return new Response(JSON.stringify({ data: [] }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" }
  });
};
const POST = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = await request.json();
  if (body.action === "generate") {
    const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return new Response("Forbidden", { status: 403 });
    }
    const batchId = body.batch_id;
    if (!batchId) {
      return new Response(JSON.stringify({ error: "batch_id required" }), { status: 400 });
    }
    const { data: items, error: itemsError } = await supabase.from("order_items").select("company_id").eq("batch_id", batchId).eq("match_status", "matched").not("company_id", "is", null);
    if (itemsError) {
      return new Response(JSON.stringify({ error: itemsError.message }), { status: 500 });
    }
    const companyCounts = /* @__PURE__ */ new Map();
    for (const item of items || []) {
      companyCounts.set(item.company_id, (companyCounts.get(item.company_id) || 0) + 1);
    }
    const availOrders = Array.from(companyCounts.entries()).map(([companyId, count]) => ({
      batch_id: batchId,
      company_id: companyId,
      total_items: count,
      status: "pending",
      sent_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
    if (availOrders.length === 0) {
      return new Response(JSON.stringify({ error: "No matched items with companies found" }), { status: 400 });
    }
    const { data: createdOrders, error: createError } = await supabase.from("availability_orders").insert(availOrders).select("*, company:companies(id, name)");
    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 500 });
    }
    for (const ao of createdOrders || []) {
      const { data: orderItems } = await supabase.from("order_items").select("id").eq("batch_id", batchId).eq("company_id", ao.company_id);
      const responses = (orderItems || []).map((item) => ({
        availability_order_id: ao.id,
        order_item_id: item.id
      }));
      if (responses.length > 0) {
        await supabase.from("availability_responses").insert(responses);
      }
    }
    const { data: batchRow } = await supabase.from("order_batches").update({ status: "availability_sent" }).eq("id", batchId).select("name").single();
    const batchName = batchRow?.name || "Order batch";
    const dispatch = await Promise.all(
      (createdOrders || []).map(
        (ao) => sendAvailabilityRequestEmail(supabase, {
          company_id: ao.company_id,
          availability_order_id: ao.id,
          batch_name: batchName,
          item_count: ao.total_items
        })
      )
    );
    const emailsSent = dispatch.filter((d) => d.sent).length;
    const emailsFailed = dispatch.filter((d) => !d.sent);
    return new Response(JSON.stringify({
      created: createdOrders?.length || 0,
      data: createdOrders,
      emails_sent: emailsSent,
      emails_failed: emailsFailed
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (body.action === "respond") {
    const responses = body.responses;
    if (!Array.isArray(responses) || responses.length === 0) {
      return new Response(JSON.stringify({ error: "responses array required" }), { status: 400 });
    }
    let updated = 0;
    for (const resp of responses) {
      const { error } = await supabase.from("availability_responses").update({
        is_available: resp.is_available,
        available_qty: resp.available_qty || null,
        comment: resp.comment || null,
        responded_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", resp.id);
      if (!error) updated++;
    }
    if (body.availability_order_id) {
      const { data: allResponses } = await supabase.from("availability_responses").select("is_available").eq("availability_order_id", body.availability_order_id);
      const total = allResponses?.length || 0;
      const available = allResponses?.filter((r) => r.is_available === true).length || 0;
      const unavailable = allResponses?.filter((r) => r.is_available === false).length || 0;
      const responded = available + unavailable;
      let status = "pending";
      if (responded === total && total > 0) status = "responded";
      else if (responded > 0) status = "partially_responded";
      await supabase.from("availability_orders").update({
        available_count: available,
        unavailable_count: unavailable,
        status,
        responded_at: status === "responded" ? (/* @__PURE__ */ new Date()).toISOString() : null
      }).eq("id", body.availability_order_id);
    }
    return new Response(JSON.stringify({ updated }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
