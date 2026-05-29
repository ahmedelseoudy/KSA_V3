import { supabase } from '../supabase';
import type { AvailabilityOrder, AvailabilityResponse, UnavailableItemSummary } from '../../types/database';

export async function getAvailabilityOrders(filters?: {
  batch_id?: string;
  company_id?: string;
  status?: string;
}): Promise<AvailabilityOrder[]> {
  let query = supabase
    .from('availability_orders')
    .select('*, company:companies(*), batch:order_batches(*)');

  if (filters?.batch_id) {
    query = query.eq('batch_id', filters.batch_id);
  }
  if (filters?.company_id) {
    query = query.eq('company_id', filters.company_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAvailabilityOrderById(id: string): Promise<AvailabilityOrder | null> {
  const { data, error } = await supabase
    .from('availability_orders')
    .select('*, company:companies(*), batch:order_batches(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createAvailabilityOrders(batchId: string): Promise<AvailabilityOrder[]> {
  // Get all matched order items grouped by company
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('company_id')
    .eq('batch_id', batchId)
    .eq('match_status', 'matched')
    .not('company_id', 'is', null);

  if (itemsError) throw itemsError;

  // Group by company and count
  const companyCounts = new Map<string, number>();
  for (const item of (items || []) as { company_id: string | null }[]) {
    if (item.company_id) {
      companyCounts.set(item.company_id, (companyCounts.get(item.company_id) || 0) + 1);
    }
  }

  // Create availability orders for each company
  const availabilityOrders = Array.from(companyCounts.entries()).map(([companyId, count]) => ({
    batch_id: batchId,
    company_id: companyId,
    total_items: count,
    status: 'pending' as const,
  }));

  if (availabilityOrders.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('availability_orders')
    .insert(availabilityOrders)
    .select('*, company:companies(*)');

  if (error) throw error;

  // Create availability response entries for each item
  for (const ao of data || []) {
    const { data: orderItems, error: oiError } = await supabase
      .from('order_items')
      .select('id')
      .eq('batch_id', batchId)
      .eq('company_id', ao.company_id);

    if (oiError) throw oiError;

    const responses = (orderItems || []).map((item: { id: string }) => ({
      availability_order_id: ao.id,
      order_item_id: item.id,
    }));

    if (responses.length > 0) {
      const { error: respError } = await supabase
        .from('availability_responses')
        .insert(responses);

      if (respError) throw respError;
    }
  }

  // Update batch status
  await supabase
    .from('order_batches')
    .update({ status: 'availability_sent' })
    .eq('id', batchId);

  return data || [];
}

export async function getAvailabilityResponses(availabilityOrderId: string): Promise<AvailabilityResponse[]> {
  const { data, error } = await supabase
    .from('availability_responses')
    .select('*, order_item:order_items(*, product:products(*))')
    .eq('availability_order_id', availabilityOrderId);

  if (error) throw error;
  return data || [];
}

export async function updateAvailabilityResponse(
  id: string,
  updates: { is_available: boolean; available_qty?: number; comment?: string }
): Promise<AvailabilityResponse> {
  const { data, error } = await supabase
    .from('availability_responses')
    .update({
      ...updates,
      responded_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Update parent availability_order counts
  await recalculateAvailabilityCounts(data.availability_order_id);

  return data;
}

export async function bulkUpdateAvailabilityResponses(
  responses: { id: string; is_available: boolean; available_qty?: number; comment?: string }[]
): Promise<void> {
  for (const resp of responses) {
    await updateAvailabilityResponse(resp.id, resp);
  }
}

async function recalculateAvailabilityCounts(availabilityOrderId: string): Promise<void> {
  const { data: responses, error } = await supabase
    .from('availability_responses')
    .select('is_available')
    .eq('availability_order_id', availabilityOrderId);

  if (error) throw error;

  const total = responses?.length || 0;
  const available = responses?.filter((r: { is_available: boolean | null }) => r.is_available === true).length || 0;
  const unavailable = responses?.filter((r: { is_available: boolean | null }) => r.is_available === false).length || 0;
  const responded = available + unavailable;

  let status: string = 'pending';
  if (responded === total && total > 0) {
    status = 'responded';
  } else if (responded > 0) {
    status = 'partially_responded';
  }

  await supabase
    .from('availability_orders')
    .update({
      available_count: available,
      unavailable_count: unavailable,
      status,
      responded_at: status === 'responded' ? new Date().toISOString() : null,
    })
    .eq('id', availabilityOrderId);
}

export async function getUnavailableItemsSummary(batchId: string): Promise<UnavailableItemSummary[]> {
  // Get all availability responses for this batch
  const { data: availOrders, error: aoError } = await supabase
    .from('availability_orders')
    .select('id, company:companies(name)')
    .eq('batch_id', batchId);

  if (aoError) throw aoError;

  const { data: responses, error: respError } = await supabase
    .from('availability_responses')
    .select('*, order_item:order_items(barcode, asin, title, order_qty), availability_order:availability_orders(company:companies(name))')
    .in('availability_order_id', (availOrders || []).map((ao: { id: string }) => ao.id));

  if (respError) throw respError;

  // Group by barcode
  const itemMap = new Map<string, UnavailableItemSummary>();

  for (const resp of responses || []) {
    const barcode = resp.order_item?.barcode;
    if (!barcode) continue;

    if (!itemMap.has(barcode)) {
      itemMap.set(barcode, {
        barcode,
        asin: resp.order_item?.asin || null,
        title: resp.order_item?.title || null,
        order_qty: resp.order_item?.order_qty || 0,
        companies_asked: [],
        companies_unavailable: [],
        all_unavailable: false,
      });
    }

    const item = itemMap.get(barcode)!;
    const companyName = (resp as any).availability_order?.company?.name || 'Unknown';

    if (!item.companies_asked.includes(companyName)) {
      item.companies_asked.push(companyName);
    }

    if (resp.is_available === false && !item.companies_unavailable.includes(companyName)) {
      item.companies_unavailable.push(companyName);
    }
  }

  // Mark items unavailable from all companies
  const results = Array.from(itemMap.values());
  for (const item of results) {
    item.all_unavailable = item.companies_asked.length > 0 &&
      item.companies_unavailable.length === item.companies_asked.length;
  }

  return results.filter(item => item.companies_unavailable.length > 0);
}
