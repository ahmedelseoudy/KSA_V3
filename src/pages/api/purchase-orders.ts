import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';
import { sendPurchaseOrderEmail, sendDeliveryConfirmationEmail } from '../../lib/notifications';
import {
  summarizeCompanyLifecycle,
  type CompanyLifecycleRow,
} from '../../utils/lifecycle/company';

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
  const view = url.searchParams.get('view') || '';

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

  // Admin decision view. This is deliberately opt-in so the default list and
  // ?id=&items=true contracts used by comparison and portal pages stay stable.
  if (view === 'lifecycle') {
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    let lifecycleQuery = supabase
      .from('v_batch_company_lifecycle')
      .select('*')
      .order('last_activity_at', { ascending: false });

    if (batch_id) lifecycleQuery = lifecycleQuery.eq('batch_id', batch_id);
    if (company_id) lifecycleQuery = lifecycleQuery.eq('company_id', company_id);
    if (status) lifecycleQuery = lifecycleQuery.eq('purchase_order_status', status);

    const { data: lifecycleData, error: lifecycleError } = await lifecycleQuery;
    if (lifecycleError) {
      return new Response(JSON.stringify({ error: lifecycleError.message }), { status: 500 });
    }

    const rows = (lifecycleData || []) as CompanyLifecycleRow[];
    const batchIds = [...new Set(rows.map((row) => row.batch_id).filter(Boolean))];
    const purchaseOrderIds = [
      ...new Set(rows.map((row) => row.purchase_order_id).filter(Boolean)),
    ] as string[];

    const [batchResult, purchaseOrderResult] = await Promise.all([
      batchIds.length > 0
        ? supabase
            .from('order_batches')
            .select('id, name, status, created_at, updated_at')
            .in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length > 0
        ? supabase
            .from('purchase_orders')
            .select('*, company:companies(id, name, email), availability_order:availability_orders(id, batch_id, batch:order_batches(id, name))')
            .in('id', purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (batchResult.error) {
      return new Response(JSON.stringify({ error: batchResult.error.message }), { status: 500 });
    }
    if (purchaseOrderResult.error) {
      return new Response(JSON.stringify({ error: purchaseOrderResult.error.message }), { status: 500 });
    }

    const batchesById = new Map(
      (batchResult.data || []).map((batch: any) => [batch.id, batch])
    );
    const purchaseOrdersById = new Map(
      (purchaseOrderResult.data || []).map((po: any) => [po.id, po])
    );
    const enrichedRows = rows.map((row) => ({
      ...row,
      batch: batchesById.get(row.batch_id) || null,
      // Compatibility shim: when a lifecycle row has a PO, this is the exact
      // legacy PO shape returned by the default endpoint.
      po: row.purchase_order_id
        ? purchaseOrdersById.get(row.purchase_order_id) || null
        : null,
    }));

    const grouped = new Map<string, typeof enrichedRows>();
    for (const row of enrichedRows) {
      const batchRows = grouped.get(row.batch_id) || [];
      batchRows.push(row);
      grouped.set(row.batch_id, batchRows);
    }

    const batches = Array.from(grouped, ([id, batchRows]) => ({
      batch: batchesById.get(id) || { id, name: 'Unknown batch' },
      rows: batchRows,
      summary: summarizeCompanyLifecycle(batchRows),
      last_activity_at: batchRows.reduce<string | null>((latest, row: any) => {
        if (!row.last_activity_at) return latest;
        return !latest || row.last_activity_at > latest ? row.last_activity_at : latest;
      }, null),
    })).sort((a, b) =>
      String(b.last_activity_at || b.batch.created_at || '').localeCompare(
        String(a.last_activity_at || a.batch.created_at || '')
      )
    );

    return new Response(JSON.stringify({
      data: enrichedRows,
      count: enrichedRows.length,
      summary: summarizeCompanyLifecycle(enrichedRows),
      batches,
    }), {
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

    const {
      batch_id,
      po_number,
      include_partial = false,
      availability_order_ids,
      delivery_date,
      dry_run = false,
    } = body as {
      batch_id?: string;
      po_number?: string;
      include_partial?: boolean;
      availability_order_ids?: string[];
      delivery_date?: string;
      dry_run?: boolean;
    };
    if (!batch_id && !(Array.isArray(availability_order_ids) && availability_order_ids.length > 0)) {
      return new Response(JSON.stringify({ error: 'Provide either batch_id or availability_order_ids[]' }), { status: 400 });
    }

    type AvailabilityOrderForPO = {
      id: string;
      company_id: string;
      batch_id: string;
      status: string;
    };
    type GenerationResult = {
      availability_order_id: string;
      company_id: string;
      outcome: 'created' | 'would_create' | 'skipped' | 'failed';
      reason?: string;
      purchase_order_id?: string;
      error?: string;
      cleanup_error?: string;
    };

    let availOrders: AvailabilityOrderForPO[] = [];
    let effectiveBatchId = batch_id || '';

    if (Array.isArray(availability_order_ids) && availability_order_ids.length > 0) {
      const requestedIds = [...new Set(availability_order_ids)];
      const { data, error } = await supabase
        .from('availability_orders')
        .select('id, company_id, batch_id, status')
        .in('id', requestedIds);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      availOrders = (data as AvailabilityOrderForPO[]) || [];
      if (availOrders.length !== requestedIds.length) {
        return new Response(JSON.stringify({ error: 'One or more availability orders were not found or are not accessible' }), { status: 400 });
      }

      const batchIds = new Set(availOrders.map((ao) => ao.batch_id));
      if (batchIds.size !== 1) {
        return new Response(JSON.stringify({ error: 'All availability orders must belong to the same batch' }), { status: 400 });
      }
      effectiveBatchId = availOrders[0].batch_id;
      if (batch_id && batch_id !== effectiveBatchId) {
        return new Response(JSON.stringify({ error: 'batch_id does not match the selected availability orders' }), { status: 400 });
      }
    } else {
      const { data, error } = await supabase
        .from('availability_orders')
        .select('id, company_id, batch_id, status')
        .eq('batch_id', batch_id as string)
        .order('created_at', { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      availOrders = (data as AvailabilityOrderForPO[]) || [];
    }

    const { data: batch, error: batchError } = await supabase
      .from('order_batches')
      .select('id, name')
      .eq('id', effectiveBatchId)
      .single();
    if (batchError || !batch) {
      return new Response(JSON.stringify({ error: batchError?.message || 'Order batch not found' }), { status: batchError ? 500 : 404 });
    }

    const { data: existingPOs, error: existingError } = await supabase
      .from('purchase_orders')
      .select('id, company_id')
      .eq('batch_id', effectiveBatchId)
      .neq('status', 'cancelled');
    if (existingError) {
      return new Response(JSON.stringify({ error: existingError.message }), { status: 500 });
    }
    const existingByCompany = new Map(
      (existingPOs || []).map((po: any) => [po.company_id, po.id])
    );
    const claimedCompanies = new Set(existingByCompany.keys());

    const createdPOs: any[] = [];
    const results: GenerationResult[] = [];
    const derivedPoNumber = po_number || batch.name || `PO-${new Date().toISOString().slice(0, 10)}`;

    for (const ao of availOrders) {
      const baseResult = {
        availability_order_id: ao.id,
        company_id: ao.company_id,
      };

      if (claimedCompanies.has(ao.company_id)) {
        const existingPOId = existingByCompany.get(ao.company_id);
        results.push({
          ...baseResult,
          outcome: 'skipped',
          reason: 'already_generated',
          ...(existingPOId ? { purchase_order_id: existingPOId } : {}),
        });
        continue;
      }

      if (ao.status === 'pending' || ao.status === 'expired' || (ao.status === 'partially_responded' && !include_partial)) {
        results.push({ ...baseResult, outcome: 'skipped', reason: 'not_responded' });
        continue;
      }

      const { data: responses, error: responsesError } = await supabase
        .from('availability_responses')
        .select('order_item_id, is_available, available_qty, order_item:order_items(id, order_qty, boxes, product_id, product:products(id, box_quantity, price_per_box))')
        .eq('availability_order_id', ao.id);

      if (responsesError) {
        results.push({
          ...baseResult,
          outcome: 'failed',
          reason: 'responses_query_failed',
          error: responsesError.message,
        });
        continue;
      }

      if (!responses || responses.length === 0) {
        results.push({ ...baseResult, outcome: 'skipped', reason: 'no_available_items' });
        continue;
      }

      const answeredResponses = responses.filter((response: any) => response.is_available !== null);
      if (answeredResponses.length === 0) {
        results.push({ ...baseResult, outcome: 'skipped', reason: 'not_responded' });
        continue;
      }

      const availableResponses = answeredResponses.filter((response: any) => response.is_available === true);
      if (availableResponses.length === 0) {
        results.push({ ...baseResult, outcome: 'skipped', reason: 'all_items_unavailable' });
        continue;
      }

      let totalAmount = 0;
      const poItems: any[] = [];

      for (const resp of availableResponses) {
        const orderItem = resp.order_item as any;
        if (!orderItem) continue;

        const product = orderItem.product;
        const qty = Number(resp.available_qty ?? orderItem.order_qty);
        if (!Number.isFinite(qty) || qty <= 0) continue;
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

      if (poItems.length === 0) {
        results.push({ ...baseResult, outcome: 'skipped', reason: 'no_resolvable_items' });
        continue;
      }

      if (dry_run) {
        claimedCompanies.add(ao.company_id);
        results.push({ ...baseResult, outcome: 'would_create' });
        continue;
      }

      // Create the PO with status 'sent' so the company can act on it.
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          batch_id: effectiveBatchId,
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

      if (poError || !po) {
        const duplicate = poError?.code === '23505';
        results.push({
          ...baseResult,
          outcome: duplicate ? 'skipped' : 'failed',
          reason: duplicate ? 'already_generated' : 'insert_failed',
          error: poError?.message || 'Purchase order insert returned no row',
        });
        continue;
      }

      // Create PO items
      const poItemsData = poItems.map(item => ({
        purchase_order_id: po.id,
        ...item,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItemsData);
      if (itemsError) {
        const { error: cleanupError } = await supabase
          .from('purchase_orders')
          .delete()
          .eq('id', po.id);
        results.push({
          ...baseResult,
          outcome: 'failed',
          reason: 'items_insert_failed',
          error: itemsError.message,
          cleanup_error: cleanupError?.message,
        });
        continue;
      }

      createdPOs.push(po);
      existingByCompany.set(ao.company_id, po.id);
      claimedCompanies.add(ao.company_id);
      results.push({
        ...baseResult,
        outcome: 'created',
        purchase_order_id: po.id,
      });
    }

    // Update batch status
    if (!dry_run && createdPOs.length > 0) {
      const { error: batchUpdateError } = await supabase
        .from('order_batches')
        .update({ status: 'po_sent' })
        .eq('id', effectiveBatchId);
      if (batchUpdateError) {
        return new Response(JSON.stringify({
          error: batchUpdateError.message,
          created: createdPOs.length,
          data: createdPOs,
          results,
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Dispatch PO emails (one per PO).
    const dispatch = dry_run ? [] : await Promise.all(
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
      results,
    }), {
      status: dry_run || createdPOs.length === 0 ? 200 : 201,
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
    const affectedPOs = new Map<string, string[]>();
    for (const item of items) {
      // Get current item to determine status
      const { data: current } = await supabase
        .from('purchase_order_items')
        .select('quantity, purchase_order_id, delivered_at')
        .eq('id', item.id)
        .single();

      if (!current) continue;

      const deliveredQty = Number(item.delivered_qty);
      if (!Number.isFinite(deliveredQty) || deliveredQty < 0) continue;

      let deliveryStatus: 'pending' | 'partial' | 'delivered' = 'pending';
      if (deliveredQty >= current.quantity) deliveryStatus = 'delivered';
      else if (deliveredQty > 0) deliveryStatus = 'partial';

      const { error } = await supabase
        .from('purchase_order_items')
        .update({
          delivered_qty: deliveredQty,
          delivery_status: deliveryStatus,
          delivery_notes: item.delivery_notes || null,
          delivered_at: deliveredQty > 0 ? (current.delivered_at || new Date().toISOString()) : null,
        })
        .eq('id', item.id);

      if (!error) {
        updated++;
        const changedItems = affectedPOs.get(current.purchase_order_id) || [];
        changedItems.push(item.id);
        affectedPOs.set(current.purchase_order_id, changedItems);
      }
    }

    // Recalculate each parent once, audit the change, then dispatch its email.
    const emailResults: any[] = [];
    for (const [poId, changedItemIds] of affectedPOs) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('id, company_id, po_number, confirmed_at, sent_at, companies:companies(user_id)')
        .eq('id', poId)
        .single();
      if (!po) continue;

      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('id, quantity, delivered_qty, delivery_status')
        .eq('purchase_order_id', poId);

      const totalItems = poItems?.length || 0;
      const deliveredCount = (poItems || []).filter((it: any) => Number(it.delivered_qty || 0) >= Number(it.quantity || 0)).length;
      const partialCount = (poItems || []).filter((it: any) => it.delivery_status === 'partial').length;

      let poStatus: 'draft' | 'sent' | 'confirmed' | 'partially_delivered' | 'delivered';
      if (deliveredCount === totalItems && totalItems > 0) {
        poStatus = 'delivered';
      } else if (deliveredCount > 0 || partialCount > 0) {
        poStatus = 'partially_delivered';
      } else {
        poStatus = po.confirmed_at ? 'confirmed' : (po.sent_at ? 'sent' : 'draft');
      }

      const { error: poUpdateError } = await supabase
        .from('purchase_orders')
        .update({ status: poStatus })
        .eq('id', poId);
      if (poUpdateError) continue;

      try {
        await supabase.from('admin_actions').insert({
          admin_id: user.id,
          action_type: 'delivery_record',
          target_user: (po as any)?.companies?.user_id || null,
          details: {
            purchase_order_id: poId,
            purchase_order_item_ids: changedItemIds,
            status: poStatus,
          },
        });
      } catch {
        // Audit failures must not prevent the delivery update itself.
      }

      const isComplete = poStatus === 'delivered';
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

  // Confirm PO — company (own) or admin/super_admin (on behalf). RLS ensures company can only confirm their own.
  if (body.action === 'confirm') {
    const { id } = body;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

    // Extra safeguard: only the linked company user (or admin) can confirm.
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role;
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('company_id, companies:companies(user_id)')
      .eq('id', id)
      .single();
    const companyUserId = (po as any)?.companies?.user_id || null;

    if (role === 'company') {
      if (companyUserId !== user.id) {
        return new Response('Forbidden', { status: 403 });
      }
    } else if (!['admin', 'super_admin'].includes(role || '')) {
      return new Response('Forbidden', { status: 403 });
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
        confirmed_by_role: role,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    // Audit trail: log when an admin confirms a PO on a company's behalf
    if (['admin', 'super_admin'].includes(role || '')) {
      try {
        await supabase.from('admin_actions').insert({
          admin_id: user.id,
          action_type: 'po_confirm_on_behalf',
          target_user: companyUserId,
          details: { purchase_order_id: id },
        });
      } catch (e) {
        // swallow audit errors; do not block API success
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
};
