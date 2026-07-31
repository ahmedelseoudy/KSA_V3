import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const batchId = url.searchParams.get('batch_id');
  if (!batchId) return new Response(JSON.stringify({ error: 'batch_id required' }), { status: 400 });

  const { data, error } = await supabase
    .from('order_items')
    .select('*, company:companies(id, name)')
    .eq('batch_id', batchId)
    .order('match_status', { ascending: true })
    .order('company_id', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response('Forbidden', { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Request body must be valid JSON' }), { status: 400 });
  }
  const { batch_id, items } = body;

  if (!batch_id || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: 'batch_id and items array required' }), { status: 400 });
  }
  if (items.length > 10000) {
    return new Response(JSON.stringify({ error: 'A single upload cannot exceed 10,000 rows' }), { status: 400 });
  }

  const invalidRow = items.findIndex((row: any) => {
    if (!row || typeof row !== 'object') return true;
    const barcode = String(row.barcode ?? '').replace(/[,\s]/g, '');
    const orderQty = Number(row.order_qty ?? 0);
    const amazonCost = Number(row.amazon_cost ?? 0);
    return !barcode || !Number.isFinite(orderQty) || orderQty < 0 || !Number.isInteger(orderQty)
      || !Number.isFinite(amazonCost) || amazonCost < 0;
  });
  if (invalidRow >= 0) {
    return new Response(JSON.stringify({
      error: `Row ${invalidRow + 1} must have a barcode, a non-negative whole order quantity, and a non-negative cost`,
    }), { status: 400 });
  }

  // Get product database for matching
  // IMPORTANT: Use database function to bypass RLS and get ALL products from ALL companies
  // PostgREST applies a default limit (often 1000). Fetch in pages to load all ~19k products.
  const pageSize = 1000;
  let page = 0;
  let products: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .rpc('get_all_products_for_matching', { in_limit: pageSize, in_offset: page * pageSize });
    if (error) {
      console.error('[Order Items] Error loading products page', page, error);
      return new Response(JSON.stringify({ error: 'Failed to load products (page ' + page + '): ' + error.message }), { status: 500 });
    }
    if (!data || data.length === 0) break;
    products = products.concat(data);
    if (data.length < pageSize) break; // last page
    page += 1;
    if (page > 100) { // safety guard
      console.warn('[Order Items] Aborting product pagination after 100 pages');
      break;
    }
  }

  const productMap = new Map<string, any>();
  for (const p of products || []) {
    productMap.set(String(p.barcode || '').replace(/[,\s]/g, ''), p);
  }

  let matched = 0;
  let missing = 0;

  const orderItems = items.map((row: any) => {
    // Normalize barcode for matching
    const barcode = String(row.barcode || '').replace(/[,\s]/g, '');
    const product = productMap.get(barcode);
    
    // Parse numeric values with better handling
    const orderQty = Number(row.order_qty) || 0;
    const amazonCost = Number(row.amazon_cost) || 0;
    const amazonCostAfterRebate = amazonCost * 0.95;
    
    // Extract title and ASIN
    const title = String(row.title || product?.title || '').trim() || null;
    const asin = String(row.asin || '').trim() || null;

    let boxes = 0;
    let providerCost = 0;
    let profitLoss = 0;
    let profitLossPct = 0;
    let companyId: string | null = null;
    let productId: string | null = null;
    let matchStatus: 'matched' | 'missing' = 'missing';

    if (product) {
      matched++;
      matchStatus = 'matched';
      productId = product.id;
      companyId = product.company_id;
      
      // Calculate boxes and costs
      if (product.box_quantity > 0) {
        boxes = orderQty / product.box_quantity;
        providerCost = boxes * parseFloat(product.price_per_box || 0);
        profitLoss = amazonCostAfterRebate - providerCost;
        profitLossPct = providerCost !== 0 ? (profitLoss / providerCost) * 100 : 0;
      }
    } else {
      missing++;
    }

    return {
      batch_id,
      product_id: productId,
      barcode,
      asin,
      title,
      company_id: companyId,
      order_qty: orderQty,
      boxes: Math.round(boxes * 100) / 100,
      amazon_cost: Math.round(amazonCost * 100) / 100,
      amazon_cost_after_rebate: Math.round(amazonCostAfterRebate * 100) / 100,
      provider_cost: Math.round(providerCost * 100) / 100,
      profit_loss: Math.round(profitLoss * 100) / 100,
      profit_loss_pct: Math.round(profitLossPct * 100) / 100,
      match_status: matchStatus,
    };
  });

  const { data: importResult, error: importError } = await supabase.rpc('replace_order_batch_items', {
    p_batch_id: batch_id,
    p_items: orderItems,
  });

  if (importError) {
    const conflict = /draft status|not found/i.test(importError.message);
    return new Response(JSON.stringify({ error: importError.message }), {
      status: conflict ? 409 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = importResult?.[0] || {};
  const saved = Number(result.saved || 0);
  const replaced = Number(result.replaced || 0);
  const warning = matched === 0
    ? 'No uploaded barcodes matched the product database. Review the file before generating availability requests.'
    : undefined;

  console.log('[Order Items] Atomic upload complete:', { saved, replaced, matched, missing });

  return new Response(JSON.stringify({ saved, replaced, matched, missing, errors: [], warning }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
