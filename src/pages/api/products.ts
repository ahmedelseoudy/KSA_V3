import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const company_id = url.searchParams.get('company_id') || '';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('products')
    .select('*, company:companies(id, name)', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`barcode.ilike.%${search}%,title.ilike.%${search}%,asin.ilike.%${search}%`);
  }
  if (company_id) {
    query = query.eq('company_id', company_id);
  }

  const [{ data, error, count }, { data: summaryRows, error: summaryError }] = await Promise.all([
    query,
    supabase
      .from('products')
      .select('company_id, price_per_box, created_at, updated_at')
      .eq('status', 'active')
      .match(company_id ? { company_id } : {}),
  ]);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (summaryError) return new Response(JSON.stringify({ error: summaryError.message }), { status: 500 });

  const summary = (summaryRows || []).reduce((result, product: any) => {
    if (product.company_id) result.companyIds.add(product.company_id);
    const price = Number(product.price_per_box);
    if (Number.isFinite(price)) {
      result.priceTotal += price;
      result.priceCount += 1;
    }
    const lastProductUpdate = product.updated_at || product.created_at;
    if (lastProductUpdate && (!result.lastUpload || lastProductUpdate > result.lastUpload)) {
      result.lastUpload = lastProductUpdate;
    }
    return result;
  }, { companyIds: new Set<string>(), priceTotal: 0, priceCount: 0, lastUpload: null as string | null });

  return new Response(JSON.stringify({
    data,
    count,
    summary: {
      companies: summary.companyIds.size,
      average_price_per_box: summary.priceCount > 0 ? summary.priceTotal / summary.priceCount : 0,
      last_upload: summary.lastUpload,
    },
  }), {
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

  if (body.bulk && Array.isArray(body.products)) {
    // Bulk upload
    const products = body.products;
    const errors: string[] = [];
    const normalizedProducts = products.map((product: any, index: number) => {
      const barcode = String(product.barcode ?? '').replace(/[\s,]/g, '');
      const boxQuantity = Number(product.box_quantity);
      const pricePerBox = Number(product.price_per_box);
      const rowNumber = index + 2;
      if (!barcode) errors.push(`Row ${rowNumber}: barcode is required`);
      if (!Number.isInteger(boxQuantity) || boxQuantity < 1) errors.push(`Row ${rowNumber}: box quantity must be a positive whole number`);
      if (!Number.isFinite(pricePerBox) || pricePerBox < 0) errors.push(`Row ${rowNumber}: price per box must be a non-negative number`);
      return {
        ...product,
        barcode,
        box_quantity: boxQuantity,
        price_per_box: pricePerBox,
      };
    }).filter((product: any, index: number) => {
      const valid = product.barcode && Number.isInteger(product.box_quantity) && product.box_quantity >= 1
        && Number.isFinite(product.price_per_box) && product.price_per_box >= 0;
      return Boolean(valid);
    });

    if (normalizedProducts.length === 0) {
      return new Response(JSON.stringify({ created: 0, updated: 0, errors: errors.length ? errors : ['No valid product rows found'] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const companyNames = [...new Set(normalizedProducts.map((p: any) => p.company).filter(Boolean))] as string[];

    // Get or create companies
    const { data: existingCompanies, error: companyLookupError } = await supabase
      .from('companies')
      .select('id, name')
      .in('name', companyNames);
    if (companyLookupError) {
      return new Response(JSON.stringify({ error: companyLookupError.message }), { status: 500 });
    }

    const companyMap = new Map<string, string>();
    for (const c of existingCompanies || []) {
      companyMap.set(c.name, c.id);
    }

    // Create missing companies
    const missingNames = companyNames.filter(n => !companyMap.has(n));
    if (missingNames.length > 0) {
      const { data: created, error: companyCreateError } = await supabase
        .from('companies')
        .insert(missingNames.map(name => ({ name })))
        .select('id, name');
      if (companyCreateError) {
        return new Response(JSON.stringify({ error: companyCreateError.message }), { status: 500 });
      }

      for (const c of created || []) {
        companyMap.set(c.name, c.id);
      }
    }

    // Prepare product data
    const upsertData = normalizedProducts.map((p: any) => ({
      barcode: p.barcode,
      asin: p.asin || null,
      title: p.title || null,
      company_id: companyMap.get(p.company) || null,
      box_quantity: p.box_quantity,
      price_per_box: p.price_per_box,
      category: p.category || null,
    }));

    // Upsert in batches
    const barcodes = [...new Set(upsertData.map((product: any) => product.barcode))];
    const { data: existingProducts, error: existingProductsError } = await supabase
      .from('products')
      .select('barcode')
      .in('barcode', barcodes);
    if (existingProductsError) {
      return new Response(JSON.stringify({ error: existingProductsError.message }), { status: 500 });
    }
    const existingBarcodes = new Set((existingProducts || []).map((product: any) => product.barcode));
    let created = 0;
    let updated = 0;
    const batchSize = 100;

    for (let i = 0; i < upsertData.length; i += batchSize) {
      const batch = upsertData.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('products')
        .upsert(batch, { onConflict: 'barcode' })
        .select();

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        for (const product of data || []) {
          if (existingBarcodes.has(product.barcode)) updated += 1;
          else created += 1;
        }
      }
    }

    return new Response(JSON.stringify({ created, updated, errors }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } else {
    // Single product create
    const barcode = String(body.barcode ?? '').replace(/[\s,]/g, '');
    const boxQuantity = Number(body.box_quantity);
    const pricePerBox = Number(body.price_per_box);
    if (!barcode) return new Response(JSON.stringify({ error: 'Barcode is required' }), { status: 400 });
    if (!Number.isInteger(boxQuantity) || boxQuantity < 1) {
      return new Response(JSON.stringify({ error: 'Box quantity must be a positive whole number' }), { status: 400 });
    }
    if (!Number.isFinite(pricePerBox) || pricePerBox < 0) {
      return new Response(JSON.stringify({ error: 'Price per box must be a non-negative number' }), { status: 400 });
    }
    const { data, error } = await supabase
      .from('products')
        .insert({
        barcode,
        asin: body.asin || null,
        title: body.title || null,
        company_id: body.company_id || null,
        box_quantity: boxQuantity,
        price_per_box: pricePerBox,
        category: body.category || null,
      })
      .select('*, company:companies(id, name)')
      .single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
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

  const body = await request.json();
  const id = String(body.id || '');
  const barcode = String(body.barcode ?? '').replace(/[\s,]/g, '');
  const boxQuantity = Number(body.box_quantity);
  const pricePerBox = Number(body.price_per_box);
  if (!id) return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
  if (!barcode) return new Response(JSON.stringify({ error: 'Barcode is required' }), { status: 400 });
  if (!Number.isInteger(boxQuantity) || boxQuantity < 1) {
    return new Response(JSON.stringify({ error: 'Box quantity must be a positive whole number' }), { status: 400 });
  }
  if (!Number.isFinite(pricePerBox) || pricePerBox < 0) {
    return new Response(JSON.stringify({ error: 'Price per box must be a non-negative number' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('products')
    .update({
      barcode,
      asin: body.asin || null,
      title: body.title || null,
      company_id: body.company_id || null,
      box_quantity: boxQuantity,
      price_per_box: pricePerBox,
      category: body.category || null,
    })
    .eq('id', id)
    .select('*, company:companies(id, name)')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify(data), {
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

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
  }

  const { data: deleted, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!deleted) {
    return new Response(JSON.stringify({ error: 'Product not found or delete was not permitted' }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
