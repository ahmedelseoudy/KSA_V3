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

  const body = await request.json();
  const { batch_id, items } = body;

  if (!batch_id || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: 'batch_id and items array required' }), { status: 400 });
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
    // Store by barcode as-is (database barcodes are already clean)
    productMap.set(p.barcode, p);
  }
  
  console.log('[Order Items] ========== MAP DEBUGGING ==========');
  console.log('[Order Items] Loaded', productMap.size, 'products for matching (paged)');
  console.log('[Order Items] Sample product barcodes from Map:', Array.from(productMap.keys()).slice(0, 10));
  console.log('[Order Items] Map has barcode "8428916027805"?', productMap.has('8428916027805'));
  console.log('[Order Items] Map has barcode "6254000115019"?', productMap.has('6254000115019'));
  console.log('[Order Items] Received', items.length, 'items to process');
  console.log('[Order Items] Sample uploaded item:', items[0]);
  console.log('[Order Items] Sample uploaded barcodes:', items.slice(0, 10).map(i => i.barcode));
  console.log('[Order Items] ===================================');

  let matched = 0;
  let missing = 0;

  const orderItems = items.map((row: any, index: number) => {
    // Normalize barcode for matching
    const barcode = String(row.barcode || '').replace(/[,\s]/g, '');
    const product = productMap.get(barcode);
    
    // Debug first 5 items in detail
    if (index < 5) {
      console.log(`\n[Order Items] ========== ITEM ${index} DEBUG ==========`);
      console.log(`  Raw barcode: "${row.barcode}" (type: ${typeof row.barcode})`);
      console.log(`  Normalized: "${barcode}" (length: ${barcode.length})`);
      console.log(`  Map.has(barcode): ${productMap.has(barcode)}`);
      console.log(`  Map.get(barcode): ${!!product}`);
      
      if (!product) {
        console.log(`  ❌ LOOKUP FAILED for: "${barcode}"`);
        
        // Manual search through all Map keys
        const mapKeys = Array.from(productMap.keys());
        const exactMatch = mapKeys.find(k => k === barcode);
        console.log(`  Manual find() result: ${!!exactMatch}`);
        
        if (exactMatch) {
          console.log(`  🚨 CRITICAL: Manual find() succeeded but Map.get() failed!`);
          console.log(`  Map key: "${exactMatch}" (length: ${exactMatch.length})`);
          console.log(`  Lookup key: "${barcode}" (length: ${barcode.length})`);
          console.log(`  Keys equal: ${exactMatch === barcode}`);
        }
        
        // Check similar barcodes
        const similar = mapKeys.filter(k => k.includes(barcode.slice(0, 8)));
        console.log(`  Similar barcodes (first 3):`, similar.slice(0, 3));
      } else {
        console.log(`  ✅ MATCHED - Company: ${product.company_id}`);
      }
      console.log(`[Order Items] =====================================`);
    }
    
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
      // Only log first 10 misses to avoid spam
      if (missing <= 10) {
        console.log(`[Order Items] MISS #${missing}: No match for barcode "${barcode}" (raw: "${row.barcode}", type: ${typeof row.barcode})`);
      }
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

  // Insert in batches
  let saved = 0;
  const batchSize = 100;
  const errors: string[] = [];

  for (let i = 0; i < orderItems.length; i += batchSize) {
    const batch = orderItems.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('order_items')
      .insert(batch)
      .select();

    if (error) {
      errors.push(error.message);
    } else {
      saved += data?.length || 0;
    }
  }

  // Update batch totals
  const totalValue = orderItems.reduce((sum: number, item: any) => sum + (item.provider_cost || 0), 0);
  await supabase
    .from('order_batches')
    .update({ total_items: saved, total_value: Math.round(totalValue * 100) / 100 })
    .eq('id', batch_id);
  
  console.log('[Order Items] Upload complete:', { saved, matched, missing, totalValue });

  return new Response(JSON.stringify({ saved, matched, missing, errors }), {
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
