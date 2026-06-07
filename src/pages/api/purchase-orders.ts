import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';
import { sendPurchaseOrderEmail, sendDeliveryConfirmationEmail } from '../../lib/notifications';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  const url = new URL(request.url);
  const batch_id = url.searchParams.get('batch_id') || '';
  const company_id = url.searchParams.get('company_id') || '';
  const po_id = url.searchParams.get('id') || '';
  const status = url.searchParams.get('status') || '';

  // If requesting items for a specific PO
  if (po_id && url.searchParams.get('items') === 'true') {
    // Fetch PO to learn its source availability_order_id (for comparison)
    const { data: poRow } = await supabase
      .from('purchase_orders')
      .select('id, availability_order_id')
      .eq('id', po_id)
      .single();

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*, product:products(id, barcode, asin, title), order_item:order_items(id, barcode, asin, title, order_qty)')
      .eq('purchase_order_id', po_id);

    if (itemsError) return new Response(JSON.stringify({ error: itemsError.message }), { status: 500 });

    let availabilityMap: Record<string, any> = {};
    if (poRow?.availability_order_id && (items || []).length > 0) {
      const orderItemIds = (items || []).map((it: any) => it.order_item_id).filter(Boolean);
      if (orderItemIds.length > 0) {
        const { data: avails } = await supabase
          .from('availability_responses')
          .select('order_item_id, is_available, available_qty, comment')
          .eq('availability_order_id', poRow.availability_order_id)
          .in('order_item_id', orderItemIds);
        availabilityMap = Object.fromEntries((avails || []).map((r: any) => [r.order_item_id, r]));
      }
    }

    const enriched = (items || []).map((it: any) => ({
      ...it,
      availability: availabilityMap[it.order_item_id || ''] || null,
    }));

    return new Response(JSON.stringify({ data: enriched }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // List purchase orders
  let query = supabase
    .from('purchase_orders')
    .select('*, company:companies(id, name, email), availability_order:availability_orders(id, batch_id, batch:order_batches(id, name))', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (batch_id) query = query.eq('batch_id', batch_id);
  if (po_id && url.searchParams.get('items') !== 'true') query = query.eq('id', po_id);
  if (status) query = query.eq('status', status);

  // Company users only see their own
  if (profile?.role === 'company') {
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (company) {
      query = query.eq('company_id', company.id);
    } else {
      return new Response(JSON.stringify({ data: [], count: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else if (company_id) {
    query = query.eq('company_id', company_id);
  }

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ data, count }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST: Create POs from availability or update delivery
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();

  // Generate POs from availability responses
  if (body.action === 'generate') {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return new Response('Forbidden', { status: 403 });
    }

    const { batch_id, po_number, include_partial, availability_order_ids, delivery_date } = body as { batch_id?: string; po_number?: string; include_partial?: boolean; availability_order_ids?: string[]; delivery_date?: string };
    if (!batch_id && !(Array.isArray(availability_order_ids) && availability_order_ids.length > 0)) {
      return new Response(JSON.stringify({ error: 'Provide either batch_id or availability_order_ids[]' }), { status: 400 });
    }

    // Get availability orders with available responses
    let availOrders: { id: string; company_id: string }[] | null = null;
    if (Array.isArray(availability_order_ids) && availability_order_ids.length > 0) {
      const { data } = await supabase
        .from('availability_orders')
        .select('id, company_id')
        .in('id', availability_order_ids);
      availOrders = (data as any) || [];
    } else {
      const statuses = include_partial ? ['responded', 'partially_responded'] : ['responded'];
      const { data } = await supabase
        .from('availability_orders')
        .select('id, company_id')
        .eq('batch_id', batch_id as string)
        .in('status', statuses);
      availOrders = (data as any) || [];
    }

    const createdPOs: any[] = [];

    for (const ao of availOrders || []) {
      // Derive PO number from availability order's batch name when not provided
      let derivedPoNumber = po_number || '';
      if (!derivedPoNumber) {
        const { data: aoMeta } = await supabase
          .from('availability_orders')
          .select('id, batch:order_batches(name)')
          .eq('id', ao.id)
          .single();
        derivedPoNumber = ((aoMeta as any)?.batch?.name || '').toString() || `PO-${new Date().toISOString().slice(0,10)}`;
      }

      const { data: responses } = await supabase
        .from('availability_responses')
        .select('order_item_id, available_qty, order_item:order_items(id, order_qty, boxes, product_id, product:products(id, box_quantity, price_per_box))')
        .eq('availability_order_id', ao.id)
        .eq('is_available', true);

      if (!responses || responses.length === 0) continue;

      let totalAmount = 0;
      const poItems: any[] = [];

      for (const resp of responses) {
        const orderItem = resp.order_item as any;
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
          total_price: Math.round(totalPrice * 100) / 100,
        });
      }

      // Create the PO with status 'sent' so the company can act on it.
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          batch_id,
          company_id: ao.company_id,
          po_number: derivedPoNumber,
          status: 'sent',
          sent_at: new Date().toISOString(),
          delivery_date: delivery_date || null,
          availability_order_id: ao.id,
          total_amount: Math.round(totalAmount * 100) / 100,
          total_items: poItems.length,
        })
        .select('*, company:companies(id, name)')
        .single();

      if (poError) continue;

      // Create PO items
      const poItemsData = poItems.map(item => ({
        purchase_order_id: po.id,
        ...item,
      }));

      await supabase.from('purchase_order_items').insert(poItemsData);
      createdPOs.push(po);
    }

    // Update batch status
    if (createdPOs.length > 0) {
      await supabase
        .from('order_batches')
        .update({ status: 'po_sent' })
        .eq('id', batch_id);
    }

    // Dispatch PO emails (one per PO).
    const dispatch = await Promise.all(
      createdPOs.map((po: any) =>
        sendPurchaseOrderEmail(supabase, {
          company_id: po.company_id,
          purchase_order_id: po.id,
          po_number: po.po_number,
          item_count: po.total_items,
          total_amount: Number(po.total_amount) || 0,
        })
      )
    );
    const emailsSent = dispatch.filter((d) => d.sent).length;
    const emailsFailed = dispatch.filter((d) => !d.sent);

    return new Response(JSON.stringify({
      created: createdPOs.length,
      data: createdPOs,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update delivery (admin only).
  if (body.action === 'update_delivery') {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return new Response('Forbidden', { status: 403 });
    }
    const { items } = body as { items: Array<{ id: string; delivered_qty: number; delivery_notes?: string }> };

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'items array required' }), { status: 400 });
    }

    let updated = 0;
    const affectedPOs: Set<string> = new Set();
    for (const item of items) {
      // Get current item to determine status
      const { data: current } = await supabase
        .from('purchase_order_items')
        .select('quantity, purchase_order_id')
        .eq('id', item.id)
        .single();

      if (!current) continue;

      let deliveryStatus: 'pending' | 'partial' | 'delivered' = 'pending';
      if (item.delivered_qty >= current.quantity) deliveryStatus = 'delivered';
      else if (item.delivered_qty > 0) deliveryStatus = 'partial';

      const { error } = await supabase
        .from('purchase_order_items')
        .update({
          delivered_qty: item.delivered_qty,
          delivery_status: deliveryStatus,
          delivery_notes: item.delivery_notes || null,
          delivered_at: item.delivered_qty > 0 ? new Date().toISOString() : null,
        })
        .eq('id', item.id);

      if (!error) updated++;
      affectedPOs.add(current.purchase_order_id);

      // Recalculate parent PO status
      const { data: allItems } = await supabase
        .from('purchase_order_items')
        .select('delivery_status')
        .eq('purchase_order_id', current.purchase_order_id);

      const total = allItems?.length || 0;
      const delivered = allItems?.filter((i: { delivery_status: string }) => i.delivery_status === 'delivered').length || 0;
      const partial = allItems?.filter((i: { delivery_status: string }) => i.delivery_status === 'partial').length || 0;

      let poStatus: string | null = null;
      if (delivered === total && total > 0) poStatus = 'delivered';
      else if (delivered > 0 || partial > 0) poStatus = 'partially_delivered';

      if (poStatus) {
        await supabase
          .from('purchase_orders')
          .update({ status: poStatus })
          .eq('id', current.purchase_order_id);
      }
    }

    // Dispatch delivery confirmation emails per affected PO
    const emailResults: any[] = [];
    for (const poId of affectedPOs) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('id, company_id, po_number, status')
        .eq('id', poId)
        .single();
      if (!po) continue;
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('id, quantity, delivered_qty')
        .eq('purchase_order_id', poId);
      const totalItems = poItems?.length || 0;
      const deliveredCount = (poItems || []).filter((it: any) => Number(it.delivered_qty || 0) >= Number(it.quantity || 0)).length;
      const isComplete = po.status === 'delivered' || (deliveredCount === totalItems && totalItems > 0);
      const result = await sendDeliveryConfirmationEmail(supabase, {
        company_id: po.company_id,
        purchase_order_id: po.id,
        po_number: po.po_number || po.id,
        delivered_count: deliveredCount,
        total_items: totalItems,
        is_complete: isComplete,
      });
      emailResults.push(result);
    }

    return new Response(JSON.stringify({ updated, emails_dispatched: emailResults.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Confirm PO (company action). RLS ensures company can only confirm their own.
  if (body.action === 'confirm') {
    const { id } = body;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

    // Extra safeguard: only the linked company user (or admin) can confirm.
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'company') {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('company_id, companies:companies(user_id)')
        .eq('id', id)
        .single();
      const companyUserId = (po as any)?.companies?.user_id;
      if (companyUserId !== user.id) {
        return new Response('Forbidden', { status: 403 });
      }
    } else if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return new Response('Forbidden', { status: 403 });
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
};
