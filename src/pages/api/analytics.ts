import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';

const ROW_PAGE_SIZE = 1000;
const MAX_LIFECYCLE_ROWS = 20_000;

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.min(100, (numerator / denominator) * 100) : 0;
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
}

function validDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function endOfDay(value: string): string {
  return `${value}T23:59:59.999Z`;
}

function summarizeRows(rows: any[]) {
  const activeRows = rows.filter(
    (row) => row.purchase_order_id && row.purchase_order_status !== 'cancelled'
  );
  const requestedItems = rows.reduce((sum, row) => sum + numeric(row.requested_items), 0);
  const answeredItems = rows.reduce((sum, row) => sum + numeric(row.answered_items), 0);
  const requestedQty = rows.reduce((sum, row) => sum + numeric(row.requested_qty), 0);
  const availableQty = rows.reduce((sum, row) => sum + numeric(row.available_qty), 0);
  const orderedQty = activeRows.reduce((sum, row) => sum + numeric(row.ordered_qty), 0);
  const deliveredQty = activeRows.reduce((sum, row) => sum + numeric(row.delivered_qty), 0);
  const orderedValue = activeRows.reduce((sum, row) => sum + numeric(row.ordered_value), 0);
  const deliveredValue = activeRows.reduce((sum, row) => sum + numeric(row.delivered_value), 0);

  return {
    companies: new Set(rows.map((row) => row.company_id).filter(Boolean)).size,
    lifecycle_rows: rows.length,
    purchase_orders: activeRows.length,
    responded_companies: rows.filter((row) => row.response_stage === 'responded').length,
    partial_companies: rows.filter((row) => row.response_stage === 'partial').length,
    awaiting_confirmation: activeRows.filter((row) => row.awaiting_confirmation).length,
    ready_to_schedule: activeRows.filter((row) => row.ready_to_schedule).length,
    overdue: activeRows.filter((row) => row.is_overdue).length,
    needs_attention: activeRows.filter(
      (row) => row.awaiting_confirmation || row.is_overdue
    ).length,
    requested_items: requestedItems,
    answered_items: answeredItems,
    requested_qty: requestedQty,
    available_qty: availableQty,
    ordered_qty: orderedQty,
    delivered_qty: deliveredQty,
    ordered_value: orderedValue,
    delivered_value: deliveredValue,
    response_rate: ratio(answeredItems, requestedItems),
    availability_rate: ratio(availableQty, requestedQty),
    fill_rate: ratio(deliveredQty, orderedQty),
    value_fill_rate: ratio(deliveredValue, orderedValue),
  };
}

function companyState(summary: ReturnType<typeof summarizeRows>): {
  state: string;
  next_action: string;
} {
  if (summary.overdue > 0) {
    return { state: 'overdue', next_action: 'Follow up on overdue delivery' };
  }
  if (summary.awaiting_confirmation > 0) {
    return { state: 'awaiting_confirmation', next_action: 'Request PO confirmation' };
  }
  if (summary.ready_to_schedule > 0) {
    return { state: 'ready_to_schedule', next_action: 'Schedule or record delivery' };
  }
  if (summary.purchase_orders > 0 && summary.fill_rate >= 100) {
    return { state: 'delivered', next_action: 'No action — delivery complete' };
  }
  if (summary.delivered_qty > 0) {
    return { state: 'partially_delivered', next_action: 'Record remaining delivery' };
  }
  if (summary.response_rate < 100) {
    return { state: 'awaiting_response', next_action: 'Collect availability response' };
  }
  return { state: 'ready_for_po', next_action: 'Review PO eligibility' };
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const url = new URL(request.url);
  const batchId = url.searchParams.get('batch_id') || '';
  const companyId = url.searchParams.get('company_id') || '';
  const dateFrom = validDate(url.searchParams.get('date_from'));
  const dateTo = validDate(url.searchParams.get('date_to'));
  const page = positiveInteger(url.searchParams.get('page'), 1, 100_000);
  const pageSize = positiveInteger(url.searchParams.get('page_size'), 25, 100);
  const sort = url.searchParams.get('sort') || 'ordered_value';
  const direction = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';

  const { data: filterBatches, error: filterBatchError } = await supabase
    .from('v_batch_lifecycle')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (filterBatchError) {
    return new Response(JSON.stringify({ error: filterBatchError.message }), { status: 500 });
  }

  let batchQuery = supabase
    .from('v_batch_lifecycle')
    .select([
      'id',
      'name',
      'status',
      'created_at',
      'last_activity_at',
      'lifecycle_stage',
      'next_action',
      'companies_count',
      'responded_companies',
      'partial_companies',
      'silent_companies',
      'purchase_order_count',
      'awaiting_confirmation_count',
      'ready_to_schedule_count',
      'overdue_count',
      'requested_qty',
      'available_qty',
      'ordered_qty',
      'delivered_qty',
      'ordered_value',
      'delivered_value',
    ].join(','), { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(500);

  if (batchId) batchQuery = batchQuery.eq('id', batchId);
  if (dateFrom) batchQuery = batchQuery.gte('created_at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) batchQuery = batchQuery.lte('created_at', endOfDay(dateTo));

  const [
    { data: filteredBatches, error: batchError, count: filteredBatchCount },
    { data: companies, error: companyError },
  ] =
    await Promise.all([
      batchQuery,
      supabase
        .from('companies')
        .select('id, name, status')
        .order('name')
        .limit(1000),
    ]);

  if (batchError) {
    return new Response(JSON.stringify({ error: batchError.message }), { status: 500 });
  }
  if (companyError) {
    return new Response(JSON.stringify({ error: companyError.message }), { status: 500 });
  }
  if (numeric(filteredBatchCount) > 500) {
    return new Response(JSON.stringify({
      error: 'Analytics currently supports up to 500 batches per view. Narrow the date or batch filter.',
    }), { status: 422 });
  }

  const batches = (filteredBatches || []) as unknown as any[];
  const batchIds = batches.map((batch) => batch.id).filter(Boolean);
  const lifecycleRows: any[] = [];

  if (batchIds.length > 0) {
    for (let offset = 0; offset < MAX_LIFECYCLE_ROWS; offset += ROW_PAGE_SIZE) {
      let lifecycleQuery = supabase
        .from('v_batch_company_lifecycle')
        .select([
          'batch_id',
          'company_id',
          'company_name',
          'response_stage',
          'requested_items',
          'answered_items',
          'requested_qty',
          'available_qty',
          'purchase_order_id',
          'purchase_order_status',
          'ordered_qty',
          'delivered_qty',
          'ordered_value',
          'delivered_value',
          'awaiting_confirmation',
          'ready_to_schedule',
          'is_overdue',
          'lifecycle_stage',
          'last_activity_at',
        ].join(','))
        .in('batch_id', batchIds)
        .order('batch_id')
        .order('company_id')
        .range(offset, offset + ROW_PAGE_SIZE - 1);

      if (companyId) lifecycleQuery = lifecycleQuery.eq('company_id', companyId);
      const { data, error } = await lifecycleQuery;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      const pageRows = (data || []) as unknown as any[];
      lifecycleRows.push(...pageRows);
      if (pageRows.length < ROW_PAGE_SIZE) break;
    }
  }

  if (lifecycleRows.length >= MAX_LIFECYCLE_ROWS) {
    return new Response(JSON.stringify({
      error: `Analytics currently supports up to ${MAX_LIFECYCLE_ROWS.toLocaleString()} lifecycle rows per filter. Narrow the date or batch filter.`,
    }), { status: 422 });
  }

  const rowsByBatch = new Map<string, any[]>();
  const rowsByCompany = new Map<string, any[]>();
  for (const row of lifecycleRows) {
    const batchRows = rowsByBatch.get(row.batch_id) || [];
    batchRows.push(row);
    rowsByBatch.set(row.batch_id, batchRows);

    const companyRows = rowsByCompany.get(row.company_id) || [];
    companyRows.push(row);
    rowsByCompany.set(row.company_id, companyRows);
  }

  const summary = {
    batches: companyId ? rowsByBatch.size : batches.length,
    ...summarizeRows(lifecycleRows),
  };

  const batchPerformance = batches
    .map((batch) => {
      const batchSummary = summarizeRows(rowsByBatch.get(batch.id) || []);
      const filteredState = companyState(batchSummary);
      return {
        id: batch.id,
        name: batch.name,
        status: batch.status,
        created_at: batch.created_at,
        last_activity_at: batch.last_activity_at,
        lifecycle_stage: companyId ? filteredState.state : batch.lifecycle_stage,
        next_action: companyId ? filteredState.next_action : batch.next_action,
        ...batchSummary,
      };
    })
    .filter((batch) => !companyId || batch.lifecycle_rows > 0);

  const companyPerformance = Array.from(rowsByCompany, ([id, rows]) => {
    const companySummary = summarizeRows(rows);
    const state = companyState(companySummary);
    return {
      id,
      name: rows[0]?.company_name || 'Unknown company',
      batches: new Set(rows.map((row) => row.batch_id)).size,
      ...companySummary,
      ...state,
    };
  });

  const sortValue = (row: any): string | number => {
    const allowed: Record<string, string> = {
      company_name: 'name',
      batches: 'batches',
      response_rate: 'response_rate',
      availability_rate: 'availability_rate',
      ordered_value: 'ordered_value',
      delivered_value: 'delivered_value',
      fill_rate: 'fill_rate',
      overdue: 'overdue',
    };
    const key = allowed[sort] || 'ordered_value';
    return key === 'name' ? String(row[key] || '').toLocaleLowerCase() : numeric(row[key]);
  };

  companyPerformance.sort((a, b) => {
    const aValue = sortValue(a);
    const bValue = sortValue(b);
    const comparison = typeof aValue === 'string'
      ? aValue.localeCompare(String(bValue))
      : aValue - Number(bValue);
    return direction === 'asc' ? comparison : -comparison;
  });

  const companyCount = companyPerformance.length;
  const pages = Math.max(1, Math.ceil(companyCount / pageSize));
  const effectivePage = Math.min(page, pages);
  const start = (effectivePage - 1) * pageSize;
  const pagedCompanies = companyPerformance.slice(start, start + pageSize);

  const lifecycleDistribution = batchPerformance.reduce<Record<string, number>>((counts, batch) => {
    const stage = batch.lifecycle_stage || 'created';
    counts[stage] = (counts[stage] || 0) + 1;
    return counts;
  }, {});

  return new Response(JSON.stringify({
    summary,
    batch_performance: batchPerformance,
    lifecycle_distribution: lifecycleDistribution,
    company_performance: {
      data: pagedCompanies,
      count: companyCount,
      page: effectivePage,
      page_size: pageSize,
      pages,
      sort,
      direction,
    },
    filters: {
      batches: filterBatches || [],
      companies: companies || [],
      applied: {
        batch_id: batchId,
        company_id: companyId,
        date_from: dateFrom,
        date_to: dateTo,
      },
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
