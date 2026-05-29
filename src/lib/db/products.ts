import { supabase } from '../supabase';
import type { Product, CreateProductInput, BulkProductRow } from '../../types/database';
import { bulkGetOrCreateCompanies } from './companies';

export async function getProducts(filters?: {
  company_id?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Product[]; count: number }> {
  let query = supabase
    .from('products')
    .select('*, company:companies(*)', { count: 'exact' });

  if (filters?.company_id) {
    query = query.eq('company_id', filters.company_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.or(`barcode.ilike.%${filters.search}%,title.ilike.%${filters.search}%,asin.ilike.%${filters.search}%`);
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

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, company:companies(*)')
    .eq('barcode', barcode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      barcode: input.barcode,
      asin: input.asin || null,
      title: input.title || null,
      company_id: input.company_id || null,
      box_quantity: input.box_quantity,
      price_per_box: input.price_per_box,
      category: input.category || null,
    })
    .select('*, company:companies(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: Partial<CreateProductInput & { status: string }>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select('*, company:companies(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function bulkUpsertProducts(rows: BulkProductRow[]): Promise<{
  created: number;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  // First, resolve all company names to IDs
  const companyNames = [...new Set(rows.map(r => r.company).filter(Boolean))];
  const companyMap = await bulkGetOrCreateCompanies(companyNames);

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const upsertData = batch.map(row => {
      const company = companyMap.get(row.company);
      return {
        barcode: row.barcode.replace(/[,\s]/g, ''),
        asin: row.asin || null,
        title: row.title || null,
        company_id: company?.id || null,
        box_quantity: row.box_quantity || 1,
        price_per_box: row.price_per_box || 0,
        category: row.category || null,
      };
    });

    const { data, error } = await supabase
      .from('products')
      .upsert(upsertData, { onConflict: 'barcode' })
      .select();

    if (error) {
      errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
    } else {
      // Count created vs updated (approximate)
      created += data?.length || 0;
    }
  }

  return { created, updated, errors };
}

export async function getProductsMap(): Promise<Map<string, Product>> {
  const productMap = new Map<string, Product>();

  // Fetch all active products
  const { data, error } = await supabase
    .from('products')
    .select('*, company:companies(*)')
    .eq('status', 'active');

  if (error) throw error;

  for (const product of data || []) {
    productMap.set(product.barcode, product);
  }

  return productMap;
}
