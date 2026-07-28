import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
  const requestedOffset = Number.parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1), 200);
  const offset = Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0);
  const requestedSort = url.searchParams.get('sort') || 'created_at';
  const sort = ['created_at', 'last_activity_at', 'name'].includes(requestedSort)
    ? requestedSort
    : 'created_at';
  const includeSummary = url.searchParams.get('summary') === 'true';

  let query = supabase
    .from('v_batch_lifecycle')
    .select('*', { count: 'exact' })
    .order(sort, { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let summary;
  if (includeSummary) {
    const { data: summaryRows, error: summaryError } = await supabase
      .from('v_batch_lifecycle')
      .select('status, purchase_order_count, delivered_count, awaiting_confirmation_count, ready_to_schedule_count, overdue_count');
    if (summaryError) {
      return new Response(JSON.stringify({ error: summaryError.message }), { status: 500 });
    }

    summary = (summaryRows || []).reduce((totals: {
      active_purchase_orders: number;
      awaiting_confirmation: number;
      ready_to_schedule: number;
      overdue: number;
    }, row: any) => {
      if (row.status !== 'cancelled') {
        totals.active_purchase_orders += Math.max(
          Number(row.purchase_order_count || 0) - Number(row.delivered_count || 0),
          0
        );
        totals.awaiting_confirmation += Number(row.awaiting_confirmation_count || 0);
        totals.ready_to_schedule += Number(row.ready_to_schedule_count || 0);
        totals.overdue += Number(row.overdue_count || 0);
      }
      return totals;
    }, {
      active_purchase_orders: 0,
      awaiting_confirmation: 0,
      ready_to_schedule: 0,
      overdue: 0,
    });
  }

  return new Response(JSON.stringify({ data, count, ...(summary ? { summary } : {}) }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Check admin role
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('order_batches')
    .insert({
      name: body.name,
      po_number: body.po_number || null,
      notes: body.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
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

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { error } = await supabase.from('order_batches').delete().eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
