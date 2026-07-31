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

  const normalizedItems = items.map((row: any) => ({
    barcode: String(row.barcode || '').replace(/[,\s]/g, ''),
    asin: String(row.asin || '').trim() || null,
    title: String(row.title || '').trim() || null,
    order_qty: Number(row.order_qty || 0),
    amazon_cost: Number(row.amazon_cost || 0),
  }));

  const { data: importResult, error: importError } = await supabase.rpc('match_and_replace_order_batch_items', {
    p_batch_id: batch_id,
    p_items: normalizedItems,
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
  const matched = Number(result.matched || 0);
  const missing = Number(result.missing || 0);
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
