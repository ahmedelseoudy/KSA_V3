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

export async function createPurchaseOrdersFromAvailability(batchId: string, poNumber: string): Promise<PurchaseOrder[]> {
  // Get all available items grouped by company
  const { data: availOrders, error: aoError } = await supabase
    .from('availability_orders')
    .select('id, company_id')
    .eq('batch_id', batchId)
    .in('status', ['responded', 'partially_responded']);

  if (aoError) throw aoError;

  const createdPOs: PurchaseOrder[] = [];

  for (const ao of availOrders || []) {
    // Get available responses for this company
    const { data: responses, error: respError } = await supabase
      .from('availability_responses')
      .select('order_item_id, available_qty, order_item:order_items(*, product:products(*))')
      .eq('availability_order_id', ao.id)
      .eq('is_available', true);

    if (respError) throw respError;
    if (!responses || responses.length === 0) continue;

    // Calculate totals
    let totalAmount = 0;
    const poItems: Array<{
      order_item_id: string;
      product_id: string | null;
      quantity: number;
      boxes: number;
      price_per_box: number;
      total_price: number;
    }> = [];

    for (const resp of responses) {
      const orderItem = resp.order_item as any;
      if (!orderItem) continue;

      const qty = resp.available_qty || orderItem.order_qty;
      const product = orderItem.product;
      const boxQty = product?.box_quantity || 1;
      const pricePerBox = product?.price_per_box || 0;
      const boxes = boxQty > 0 ? qty / boxQty : 0;
      const totalPrice = boxes * pricePerBox;

      totalAmount += totalPrice;
      poItems.push({
        order_item_id: resp.order_item_id,
        product_id: product?.id || null,
        quantity: qty,
        boxes,
        price_per_box: pricePerBox,
        total_price: totalPrice,
      });
    }

    // Create the purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        batch_id: batchId,
        company_id: ao.company_id,
        po_number: poNumber,
        status: 'draft',
        total_amount: totalAmount,
        total_items: poItems.length,
      })
      .select('*, company:companies(*)')
      .single();

    if (poError) throw poError;

    // Create PO items
    const poItemsData = poItems.map(item => ({
      purchase_order_id: po.id,
      ...item,
    }));

    const { error: poItemsError } = await supabase
      .from('purchase_order_items')
      .insert(poItemsData);

    if (poItemsError) throw poItemsError;

    createdPOs.push(po);
  }

  // Update batch status
  if (createdPOs.length > 0) {
    await supabase
      .from('order_batches')
      .update({ status: 'po_sent' })
      .eq('id', batchId);
  }

  return createdPOs;
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
