// ============================================
// Database entity types for the CRM system
// ============================================

export interface Company {
  id: string;
  name: string;
  email: string | null;
  additional_emails: string[];
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  user_id: string | null;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  barcode: string;
  asin: string | null;
  title: string | null;
  company_id: string | null;
  box_quantity: number;
  price_per_box: number;
  category: string | null;
  status: 'active' | 'discontinued';
  created_at: string;
  updated_at: string;
  // Joined fields
  company?: Company;
}

export interface OrderBatch {
  id: string;
  name: string;
  po_number: string | null;
  created_by: string | null;
  status: 'draft' | 'availability_sent' | 'po_sent' | 'partially_delivered' | 'completed' | 'cancelled';
  total_items: number;
  total_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  batch_id: string;
  product_id: string | null;
  barcode: string;
  asin: string | null;
  title: string | null;
  company_id: string | null;
  order_qty: number;
  boxes: number;
  amazon_cost: number;
  amazon_cost_after_rebate: number;
  provider_cost: number;
  profit_loss: number;
  profit_loss_pct: number;
  match_status: 'matched' | 'missing';
  created_at: string;
  // Joined fields
  company?: Company;
  product?: Product;
}

export interface AvailabilityOrder {
  id: string;
  batch_id: string;
  company_id: string;
  status: 'pending' | 'partially_responded' | 'responded' | 'expired';
  sent_at: string | null;
  responded_at: string | null;
  total_items: number;
  available_count: number;
  unavailable_count: number;
  notes: string | null;
  created_at: string;
  // Joined fields
  company?: Company;
  batch?: OrderBatch;
}

export interface AvailabilityResponse {
  id: string;
  availability_order_id: string;
  order_item_id: string;
  is_available: boolean | null;
  available_qty: number | null;
  comment: string | null;
  responded_at: string | null;
  created_at: string;
  // Joined fields
  order_item?: OrderItem;
}

export interface PurchaseOrder {
  id: string;
  batch_id: string;
  company_id: string;
  po_number: string | null;
  status: 'draft' | 'sent' | 'confirmed' | 'partially_delivered' | 'delivered' | 'cancelled';
  total_amount: number;
  total_items: number;
  sent_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  company?: Company;
  batch?: OrderBatch;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  order_item_id: string | null;
  product_id: string | null;
  quantity: number;
  boxes: number;
  price_per_box: number;
  total_price: number;
  delivered_qty: number;
  delivery_status: 'pending' | 'partial' | 'delivered';
  delivery_notes: string | null;
  delivered_at: string | null;
  created_at: string;
  // Joined fields
  product?: Product;
  order_item?: OrderItem;
}

export interface Notification {
  id: string;
  recipient_id: string | null;
  company_id: string | null;
  type: 'availability_request' | 'po_sent' | 'delivery_reminder' | 'system' | 'order_completed';
  subject: string;
  body: string | null;
  status: 'pending' | 'sent' | 'failed' | 'read';
  sent_at: string | null;
  created_at: string;
}

// ============================================
// Form / Input types
// ============================================

export interface CreateCompanyInput {
  name: string;
  email?: string;
  additional_emails?: string[];
  phone?: string;
  address?: string;
  contact_person?: string;
}

export interface CreateProductInput {
  barcode: string;
  asin?: string;
  title?: string;
  company_id?: string;
  box_quantity: number;
  price_per_box: number;
  category?: string;
}

export interface BulkProductRow {
  barcode: string;
  company: string;
  box_quantity: number;
  price_per_box: number;
  asin?: string;
  title?: string;
  category?: string;
}

export interface CreateOrderBatchInput {
  name: string;
  po_number?: string;
  notes?: string;
}

export interface DeliveryUpdateInput {
  purchase_order_item_id: string;
  delivered_qty: number;
  delivery_notes?: string;
}

// ============================================
// Analytics / Summary types
// ============================================

export interface CompanySummary {
  company: Company;
  total_products: number;
  total_orders: number;
  total_available: number;
  total_unavailable: number;
  availability_rate: number;
  total_po_value: number;
  total_delivered: number;
  delivery_rate: number;
}

export interface BatchSummary {
  batch: OrderBatch;
  companies_count: number;
  matched_items: number;
  missing_items: number;
  total_profit: number;
  total_loss: number;
  availability_status: {
    pending: number;
    responded: number;
    total: number;
  };
}

export interface UnavailableItemSummary {
  barcode: string;
  asin: string | null;
  title: string | null;
  order_qty: number;
  companies_asked: string[];
  companies_unavailable: string[];
  all_unavailable: boolean;
}
