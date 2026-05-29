import { supabase } from '../supabase';
import type { OrderBatch, OrderItem, CreateOrderBatchInput } from '../../types/database';
import { getProductsMap } from './products';

export async function getOrderBatches(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: OrderBatch[]; count: number }> {
  let query = supabase
    .from('order_batches')
    .select('*', { count: 'exact' });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    const offset = filters.offset || 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getOrderBatchById(id: string): Promise<OrderBatch | null> {
  const { data, error } = await supabase
    .from('order_batches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createOrderBatch(input: CreateOrderBatchInput, userId: string): Promise<OrderBatch> {
  const { data, error } = await supabase
    .from('order_batches')
    .insert({
      name: input.name,
      po_number: input.po_number || null,
      notes: input.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrderBatch(id: string, updates: Partial<OrderBatch>): Promise<OrderBatch> {
  const { data, error } = await supabase
    .from('order_batches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrderBatch(id: string): Promise<void> {
  const { error } = await supabase
    .from('order_batches')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getOrderItems(batchId: string, filters?: {
  company_id?: string;
  match_status?: string;
}): Promise<OrderItem[]> {
  let query = supabase
    .from('order_items')
    .select('*, company:companies(*), product:products(*)')
    .eq('batch_id', batchId);

  if (filters?.company_id) {
    query = query.eq('company_id', filters.company_id);
  }
  if (filters?.match_status) {
    query = query.eq('match_status', filters.match_status);
  }

  query = query.order('title');

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function deleteOrderItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Process and save order items from parsed file data
export interface ParsedOrderRow {
  barcode: string;
  asin: string;
  title: string;
  orderQty: number;
  totalCost: number;
}

export async function processAndSaveOrderItems(
  batchId: string,
  parsedRows: ParsedOrderRow[]
): Promise<{ saved: number; matched: number; missing: number }> {
  // Get the product database map
  const productMap = await getProductsMap();

  let matched = 0;
  let missing = 0;

  const orderItems = parsedRows.map(row => {
    const barcode = row.barcode.replace(/[,\s]/g, '');
    const product = productMap.get(barcode);

    const orderQty = row.orderQty;
    const amazonCost = row.totalCost;
    const amazonCostAfterRebate = amazonCost * 0.95;

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
      boxes = product.box_quantity > 0 ? orderQty / product.box_quantity : 0;
      providerCost = boxes * product.price_per_box;
      profitLoss = amazonCostAfterRebate - providerCost;
      profitLossPct = providerCost !== 0 ? (profitLoss / providerCost) * 100 : 0;
    } else {
      missing++;
    }

    return {
      batch_id: batchId,
      product_id: productId,
      barcode,
      asin: row.asin || null,
      title: row.title || null,
      company_id: companyId,
      order_qty: orderQty,
      boxes,
      amazon_cost: amazonCost,
      amazon_cost_after_rebate: amazonCostAfterRebate,
      provider_cost: providerCost,
      profit_loss: profitLoss,
      profit_loss_pct: profitLossPct,
      match_status: matchStatus,
    };
  });

  // Insert in batches of 100
  const batchSize = 100;
  let saved = 0;
  for (let i = 0; i < orderItems.length; i += batchSize) {
    const batch = orderItems.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('order_items')
      .insert(batch)
      .select();

    if (error) throw error;
    saved += data?.length || 0;
  }

  // Update batch totals
  const totalValue = orderItems.reduce((sum, item) => sum + item.provider_cost, 0);
  await updateOrderBatch(batchId, {
    total_items: saved,
    total_value: totalValue,
  } as any);

  return { saved, matched, missing };
}
