import { supabase } from '../supabase';
import type { PurchaseOrder, PurchaseOrderItem, DeliveryUpdateInput } from '../../types/database';

export async function getPurchaseOrders(filters?: {
  batch_id?: string;
  company_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: PurchaseOrder[]; count: number }> {
  let query = supabase
    .from('purchase_orders')
    .select('*, company:companies(*), batch:order_batches(*)', { count: 'exact' });

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

  if (filters?.limit) {
    const offset = filters.offset || 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, company:companies(*), batch:order_batches(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('*, product:products(*), order_item:order_items(*)')
    .eq('purchase_order_id', purchaseOrderId);

  if (error) throw error;
  return data || [];
}

export async function updatePurchaseOrderStatus(id: string, status: PurchaseOrder['status']): Promise<PurchaseOrder> {
  const updates: Record<string, any> = { status };
  if (status === 'sent') updates.sent_at = new Date().toISOString();
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('purchase_orders')
    .update(updates)
    .eq('id', id)
    .select('*, company:companies(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateDelivery(input: DeliveryUpdateInput): Promise<PurchaseOrderItem> {
  const { data: item, error: fetchError } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('id', input.purchase_order_item_id)
    .single();

  if (fetchError) throw fetchError;

  let deliveryStatus: 'pending' | 'partial' | 'delivered' = 'pending';
  if (input.delivered_qty >= item.quantity) {
    deliveryStatus = 'delivered';
  } else if (input.delivered_qty > 0) {
    deliveryStatus = 'partial';
  }

  const { data, error } = await supabase
    .from('purchase_order_items')
    .update({
      delivered_qty: input.delivered_qty,
      delivery_status: deliveryStatus,
      delivery_notes: input.delivery_notes || null,
      delivered_at: input.delivered_qty > 0 ? new Date().toISOString() : null,
    })
    .eq('id', input.purchase_order_item_id)
    .select('*, product:products(*)')
    .single();

  if (error) throw error;

  // Recalculate parent PO delivery status
  await recalculatePODeliveryStatus(item.purchase_order_id);

  return data;
}

async function recalculatePODeliveryStatus(purchaseOrderId: string): Promise<void> {
  const { data: items, error } = await supabase
    .from('purchase_order_items')
    .select('delivery_status')
    .eq('purchase_order_id', purchaseOrderId);

  if (error) return;

  const total = items?.length || 0;
  const delivered = items?.filter((i: { delivery_status: string }) => i.delivery_status === 'delivered').length || 0;
  const partial = items?.filter((i: { delivery_status: string }) => i.delivery_status === 'partial').length || 0;

  let status: string;
  if (delivered === total && total > 0) {
    status = 'delivered';
  } else if (delivered > 0 || partial > 0) {
    status = 'partially_delivered';
  } else {
    return; // No change needed
  }

  await supabase
    .from('purchase_orders')
    .update({ status })
    .eq('id', purchaseOrderId);
}

export async function getDeliverySummary(purchaseOrderId: string): Promise<{
  total_items: number;
  fully_delivered: number;
  partially_delivered: number;
  pending: number;
  total_qty_ordered: number;
  total_qty_delivered: number;
  delivery_rate: number;
}> {
  const { data: items, error } = await supabase
    .from('purchase_order_items')
    .select('quantity, delivered_qty, delivery_status')
    .eq('purchase_order_id', purchaseOrderId);

  if (error) throw error;

  const result = {
    total_items: items?.length || 0,
    fully_delivered: 0,
    partially_delivered: 0,
    pending: 0,
    total_qty_ordered: 0,
    total_qty_delivered: 0,
    delivery_rate: 0,
  };

  for (const item of items || []) {
    result.total_qty_ordered += item.quantity;
    result.total_qty_delivered += item.delivered_qty;

    switch (item.delivery_status) {
      case 'delivered':
        result.fully_delivered++;
        break;
      case 'partial':
        result.partially_delivered++;
        break;
      default:
        result.pending++;
    }
  }

  result.delivery_rate = result.total_qty_ordered > 0
    ? (result.total_qty_delivered / result.total_qty_ordered) * 100
    : 0;

  return result;
}
