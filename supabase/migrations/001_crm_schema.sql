-- KSA V3 CRM Schema Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. COMPANIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  additional_emails TEXT[] DEFAULT '{}',
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_name ON public.companies(name);
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
CREATE INDEX idx_companies_status ON public.companies(status);

-- ============================================
-- 2. PRODUCTS TABLE (master product database)
-- ============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL UNIQUE,
  asin TEXT,
  title TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  box_quantity INTEGER NOT NULL DEFAULT 1,
  price_per_box NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_company_id ON public.products(company_id);
CREATE INDEX idx_products_asin ON public.products(asin);

-- ============================================
-- 3. ORDER BATCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  po_number TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'availability_sent', 'po_sent', 'partially_delivered', 'completed', 'cancelled')),
  total_items INTEGER DEFAULT 0,
  total_value NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_batches_status ON public.order_batches(status);
CREATE INDEX idx_order_batches_created_by ON public.order_batches(created_by);

-- ============================================
-- 4. ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.order_batches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  barcode TEXT NOT NULL,
  asin TEXT,
  title TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  order_qty INTEGER NOT NULL DEFAULT 0,
  boxes NUMERIC(10,2) DEFAULT 0,
  amazon_cost NUMERIC(12,2) DEFAULT 0,
  amazon_cost_after_rebate NUMERIC(12,2) DEFAULT 0,
  provider_cost NUMERIC(12,2) DEFAULT 0,
  profit_loss NUMERIC(12,2) DEFAULT 0,
  profit_loss_pct NUMERIC(8,2) DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'missing' CHECK (match_status IN ('matched', 'missing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_batch_id ON public.order_items(batch_id);
CREATE INDEX idx_order_items_company_id ON public.order_items(company_id);
CREATE INDEX idx_order_items_barcode ON public.order_items(barcode);
CREATE INDEX idx_order_items_match_status ON public.order_items(match_status);

-- ============================================
-- 5. AVAILABILITY ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.availability_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.order_batches(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_responded', 'responded', 'expired')),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  total_items INTEGER DEFAULT 0,
  available_count INTEGER DEFAULT 0,
  unavailable_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_availability_orders_batch_id ON public.availability_orders(batch_id);
CREATE INDEX idx_availability_orders_company_id ON public.availability_orders(company_id);
CREATE INDEX idx_availability_orders_status ON public.availability_orders(status);

-- ============================================
-- 6. AVAILABILITY RESPONSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.availability_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_order_id UUID NOT NULL REFERENCES public.availability_orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  is_available BOOLEAN,
  available_qty INTEGER,
  comment TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_availability_responses_order_id ON public.availability_responses(availability_order_id);
CREATE INDEX idx_availability_responses_item_id ON public.availability_responses(order_item_id);

-- ============================================
-- 7. PURCHASE ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.order_batches(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  po_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'partially_delivered', 'delivered', 'cancelled')),
  total_amount NUMERIC(14,2) DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_orders_batch_id ON public.purchase_orders(batch_id);
CREATE INDEX idx_purchase_orders_company_id ON public.purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

-- ============================================
-- 8. PURCHASE ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  boxes NUMERIC(10,2) DEFAULT 0,
  price_per_box NUMERIC(12,2) DEFAULT 0,
  total_price NUMERIC(12,2) DEFAULT 0,
  delivered_qty INTEGER DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'partial', 'delivered')),
  delivery_notes TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_items_po_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_product_id ON public.purchase_order_items(product_id);
CREATE INDEX idx_po_items_delivery_status ON public.purchase_order_items(delivery_status);

-- ============================================
-- 9. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('availability_request', 'po_sent', 'delivery_reminder', 'system', 'order_completed')),
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_company ON public.notifications(company_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);

-- ============================================
-- 10. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: get company_id for current user
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.companies
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COMPANIES: admins see all, company users see own
CREATE POLICY "Admins can do everything with companies"
  ON public.companies FOR ALL
  USING (public.is_admin());

CREATE POLICY "Company users can view own company"
  ON public.companies FOR SELECT
  USING (user_id = auth.uid());

-- PRODUCTS: admins full access, company users see own products
CREATE POLICY "Admins can do everything with products"
  ON public.products FOR ALL
  USING (public.is_admin());

CREATE POLICY "Company users can view own products"
  ON public.products FOR SELECT
  USING (company_id = public.get_user_company_id());

-- ORDER BATCHES: admins only
CREATE POLICY "Admins can do everything with order_batches"
  ON public.order_batches FOR ALL
  USING (public.is_admin());

-- ORDER ITEMS: admins full access, company users see own
CREATE POLICY "Admins can do everything with order_items"
  ON public.order_items FOR ALL
  USING (public.is_admin());

CREATE POLICY "Company users can view own order_items"
  ON public.order_items FOR SELECT
  USING (company_id = public.get_user_company_id());

-- AVAILABILITY ORDERS: admins full, company users see own
CREATE POLICY "Admins can do everything with availability_orders"
  ON public.availability_orders FOR ALL
  USING (public.is_admin());

CREATE POLICY "Company users can view own availability_orders"
  ON public.availability_orders FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company users can update own availability_orders"
  ON public.availability_orders FOR UPDATE
  USING (company_id = public.get_user_company_id());

-- AVAILABILITY RESPONSES: admins full, company users can respond to own
CREATE POLICY "Admins can do everything with availability_responses"
  ON public.availability_responses FOR ALL
  USING (public.is_admin());

CREATE POLICY "Company users can view own availability_responses"
  ON public.availability_responses FOR SELECT
  USING (
    availability_order_id IN (
      SELECT id FROM public.availability_orders
      WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Company users can insert own availability_responses"
  ON public.availability_responses FOR INSERT
  WITH CHECK (
    availability_order_id IN (
      SELECT id FROM public.availability_orders
      WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Company users can update own availability_responses"
  ON public.availability_responses FOR UPDATE
  USING (
    availability_order_id IN (
      SELECT id FROM public.availability_orders
      WHERE company_id = public.get_user_company_id()
    )
  );

-- PURCHASE ORDERS: admins full, company users see own
CREATE POLICY "Admins can do everything with purchase_orders"
  ON public.purchase_orders FOR ALL
  USING (public.is_admin());

CREATE POLICY "Company users can view own purchase_orders"
  ON public.purchase_orders FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company users can update own purchase_orders"
  ON public.purchase_orders FOR UPDATE
  USING (company_id = public.get_user_company_id());

-- PURCHASE ORDER ITEMS: admins full, company users see own
CREATE POLICY "Admins can do everything with purchase_order_items"
  ON public.purchase_order_items FOR ALL
  USING (public.is_admin());

CREATE POLICY "Company users can view own purchase_order_items"
  ON public.purchase_order_items FOR SELECT
  USING (
    purchase_order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE company_id = public.get_user_company_id()
    )
  );

-- NOTIFICATIONS: users see own
CREATE POLICY "Admins can do everything with notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid());

-- ============================================
-- 11. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_order_batches_updated_at
  BEFORE UPDATE ON public.order_batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 12. ADD 'company' TO ROLE OPTIONS
-- ============================================
-- Update the users_profile check constraint to include 'company' role
ALTER TABLE public.users_profile DROP CONSTRAINT IF EXISTS users_profile_role_check;
ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_role_check
  CHECK (role IN ('user', 'admin', 'super_admin', 'company'));
