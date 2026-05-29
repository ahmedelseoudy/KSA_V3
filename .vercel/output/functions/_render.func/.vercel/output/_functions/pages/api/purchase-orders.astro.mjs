import { c as createSupabaseServerClient } from '../../chunks/supabase-server_BsVI-CzH.mjs';
import { a as sendPurchaseOrderEmail } from '../../chunks/notifications_BnWJkShD.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';

const GET = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  const url = new URL(request.url);
  const batch_id = url.searchParams.get("batch_id") || "";
  const company_id = url.searchParams.get("company_id") || "";
  const po_id = url.searchParams.get("id") || "";
  const status = url.searchParams.get("status") || "";
  if (po_id && url.searchParams.get("items") === "true") {
    const { data: data2, error: error2 } = await supabase.from("purchase_order_items").select("*, product:products(id, barcode, asin, title)").eq("purchase_order_id", po_id);
    if (error2) return new Response(JSON.stringify({ error: error2.message }), { status: 500 });
    return new Response(JSON.stringify({ data: data2 }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  let query = supabase.from("purchase_orders").select("*, company:companies(id, name, email)", { count: "exact" }).order("created_at", { ascending: false });
  if (batch_id) query = query.eq("batch_id", batch_id);
  if (status) query = query.eq("status", status);
  if (profile?.role === "company") {
    const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).single();
    if (company) {
      query = query.eq("company_id", company.id);
    } else {
      return new Response(JSON.stringify({ data: [], count: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } else if (company_id) {
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
  const body = await request.json();
  if (body.action === "generate") {
    const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return new Response("Forbidden", { status: 403 });
    }
    const { batch_id, po_number } = body;
    if (!batch_id || !po_number) {
      return new Response(JSON.stringify({ error: "batch_id and po_number required" }), { status: 400 });
    }
    const { data: availOrders } = await supabase.from("availability_orders").select("id, company_id").eq("batch_id", batch_id).in("status", ["responded", "partially_responded"]);
    const createdPOs = [];
    for (const ao of availOrders || []) {
      const { data: responses } = await supabase.from("availability_responses").select("order_item_id, available_qty, order_item:order_items(id, order_qty, boxes, product_id, product:products(id, box_quantity, price_per_box))").eq("availability_order_id", ao.id).eq("is_available", true);
      if (!responses || responses.length === 0) continue;
      let totalAmount = 0;
      const poItems = [];
      for (const resp of responses) {
        const orderItem = resp.order_item;
        if (!orderItem) continue;
        const product = orderItem.product;
        const qty = resp.available_qty || orderItem.order_qty;
        const boxQty = product?.box_quantity || 1;
        const pricePerBox = product?.price_per_box || 0;
        const boxes = boxQty > 0 ? qty / boxQty : 0;
        const totalPrice = boxes * pricePerBox;
        totalAmount += totalPrice;
        poItems.push({
          order_item_id: resp.order_item_id,
          product_id: product?.id || null,
          quantity: qty,
          boxes: Math.round(boxes * 100) / 100,
          price_per_box: pricePerBox,
          total_price: Math.round(totalPrice * 100) / 100
        });
      }
      const { data: po, error: poError } = await supabase.from("purchase_orders").insert({
        batch_id,
        company_id: ao.company_id,
        po_number,
        status: "sent",
        sent_at: (/* @__PURE__ */ new Date()).toISOString(),
        total_amount: Math.round(totalAmount * 100) / 100,
        total_items: poItems.length
      }).select("*, company:companies(id, name)").single();
      if (poError) continue;
      const poItemsData = poItems.map((item) => ({
        purchase_order_id: po.id,
        ...item
      }));
      await supabase.from("purchase_order_items").insert(poItemsData);
      createdPOs.push(po);
    }
    if (createdPOs.length > 0) {
      await supabase.from("order_batches").update({ status: "po_sent" }).eq("id", batch_id);
    }
    const dispatch = await Promise.all(
      createdPOs.map(
        (po) => sendPurchaseOrderEmail(supabase, {
          company_id: po.company_id,
          purchase_order_id: po.id,
          po_number: po.po_number,
          item_count: po.total_items,
          total_amount: Number(po.total_amount) || 0
        })
      )
    );
    const emailsSent = dispatch.filter((d) => d.sent).length;
    const emailsFailed = dispatch.filter((d) => !d.sent);
    return new Response(JSON.stringify({
      created: createdPOs.length,
      data: createdPOs,
      emails_sent: emailsSent,
      emails_failed: emailsFailed
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (body.action === "update_delivery") {
    const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return new Response("Forbidden", { status: 403 });
    }
    const { items } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "items array required" }), { status: 400 });
    }
    let updated = 0;
    for (const item of items) {
      const { data: current } = await supabase.from("purchase_order_items").select("quantity, purchase_order_id").eq("id", item.id).single();
      if (!current) continue;
      let deliveryStatus = "pending";
      if (item.delivered_qty >= current.quantity) deliveryStatus = "delivered";
      else if (item.delivered_qty > 0) deliveryStatus = "partial";
      const { error } = await supabase.from("purchase_order_items").update({
        delivered_qty: item.delivered_qty,
        delivery_status: deliveryStatus,
        delivery_notes: item.delivery_notes || null,
        delivered_at: item.delivered_qty > 0 ? (/* @__PURE__ */ new Date()).toISOString() : null
      }).eq("id", item.id);
      if (!error) updated++;
      const { data: allItems } = await supabase.from("purchase_order_items").select("delivery_status").eq("purchase_order_id", current.purchase_order_id);
      const total = allItems?.length || 0;
      const delivered = allItems?.filter((i) => i.delivery_status === "delivered").length || 0;
      const partial = allItems?.filter((i) => i.delivery_status === "partial").length || 0;
      let poStatus = null;
      if (delivered === total && total > 0) poStatus = "delivered";
      else if (delivered > 0 || partial > 0) poStatus = "partially_delivered";
      if (poStatus) {
        await supabase.from("purchase_orders").update({ status: poStatus }).eq("id", current.purchase_order_id);
      }
    }
    return new Response(JSON.stringify({ updated }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (body.action === "confirm") {
    const { id } = body;
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400 });
    const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
    if (profile?.role === "company") {
      const { data: po } = await supabase.from("purchase_orders").select("company_id, companies:companies(user_id)").eq("id", id).single();
      const companyUserId = po?.companies?.user_id;
      if (companyUserId !== user.id) {
        return new Response("Forbidden", { status: 403 });
      }
    } else if (!["admin", "super_admin"].includes(profile?.role || "")) {
      return new Response("Forbidden", { status: 403 });
    }
    const { data, error } = await supabase.from("purchase_orders").update({ status: "confirmed", confirmed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select().single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify(data), {
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
