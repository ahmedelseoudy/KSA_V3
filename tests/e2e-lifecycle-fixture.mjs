#!/usr/bin/env node
/*
 Repeatable lifecycle fixture:
 - Creates two no-email companies with two products each
 - Creates one batch and matches four order items
 - Records one complete response and one partial response
 - Verifies default/include-partial PO eligibility, creation, and duplicate handling
 - Locks the legacy PO list/item response shapes and lifecycle decision response
 - Verifies base-table RLS, public APIs, and migration 007's lifecycle views as two disposable company users
 - Removes the batch, products, companies, audit rows, and auth users in finally

 Required:
   ADMIN_PASSWORD
   PUBLIC_SUPABASE_URL
   PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY

 The Supabase values may be supplied by the ignored local .env file.
 Optional:
   BASE_URL (defaults to http://localhost:4321)
   ADMIN_EMAIL (defaults to admin@ksa-crm.com)
*/

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

function loadDotEnv() {
  if (!fs.existsSync('.env')) return {};
  return Object.fromEntries(
    fs.readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

const dotEnv = loadDotEnv();
const env = (name, fallback = '') => process.env[name] || dotEnv[name] || fallback;
const BASE_URL = env('BASE_URL', env('PUBLIC_APP_URL', 'http://localhost:4321')).replace(/\/$/, '');
const ADMIN_EMAIL = env('ADMIN_EMAIL', 'admin@ksa-crm.com');
const ADMIN_PASSWORD = env('ADMIN_PASSWORD');
const SUPABASE_URL = env('PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const SUPABASE_ANON_KEY = env('PUBLIC_SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

for (const [name, value] of Object.entries({
  ADMIN_PASSWORD,
  PUBLIC_SUPABASE_URL: SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!value) {
    console.error(`ERROR: ${name} is required.`);
    process.exit(1);
  }
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromResponse(response) {
    const headers = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') || ''];
    for (const header of headers.flatMap((value) => value.split(/,(?=[^;,]+=)/))) {
      const segment = header.split(';', 1)[0].trim();
      const separator = segment.indexOf('=');
      if (separator > 0) {
        this.cookies.set(segment.slice(0, separator), segment.slice(separator + 1));
      }
    }
  }

  header() {
    return Array.from(this.cookies, ([key, value]) => `${key}=${value}`).join('; ');
  }

  get(name) {
    return this.cookies.get(name) || '';
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function appApi(pathname, options, jar, { allowFailure = false } = {}) {
  const headers = new Headers(options?.headers || {});
  if (!headers.has('Content-Type') && options?.body) headers.set('Content-Type', 'application/json');
  if (jar) headers.set('Cookie', jar.header());
  const response = await fetch(`${BASE_URL}${pathname}`, { ...options, headers });
  const json = await parseResponse(response);
  if (!response.ok && !allowFailure) {
    throw new Error(`${pathname} ${response.status}: ${json.error || json.raw || 'request failed'}`);
  }
  return { status: response.status, json };
}

async function appPage(pathname, jar) {
  const startedAt = performance.now();
  const response = await fetch(`${BASE_URL}${pathname}`, {
    headers: { Cookie: jar.header() },
  });
  const text = await response.text();
  return { status: response.status, durationMs: Math.round(performance.now() - startedAt), text };
}

async function adminLogin(jar) {
  const form = new URLSearchParams({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
  });
  jar.setFromResponse(response);
  assert.ok([200, 302].includes(response.status), `admin login returned ${response.status}`);
  assert.ok(jar.get('sb-access-token'), 'admin login did not set sb-access-token');
}

async function userLogin(jar, email, password) {
  const form = new URLSearchParams({ email, password });
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
  });
  jar.setFromResponse(response);
  assert.ok([200, 302].includes(response.status), `company login returned ${response.status}`);
  assert.ok(jar.get('sb-access-token'), 'company login did not set sb-access-token');
}

async function supabaseRequest(
  pathname,
  { method = 'GET', body, token = SUPABASE_SERVICE_ROLE_KEY, key = SUPABASE_SERVICE_ROLE_KEY, headers = {} } = {}
) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await parseResponse(response);
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${pathname} ${response.status}: ${json.message || json.error || json.raw || 'request failed'}`);
  }
  return json;
}

async function restRows(view, batchId, token) {
  const params = new URLSearchParams({
    select: '*',
    [view === 'v_batch_lifecycle' ? 'id' : 'batch_id']: `eq.${batchId}`,
  });
  return supabaseRequest(`/rest/v1/${view}?${params}`, {
    token,
    key: SUPABASE_ANON_KEY,
  });
}

async function restTableRows(table, filterName, filterValue, token, select = '*') {
  const params = new URLSearchParams({
    select,
    [filterName]: `eq.${filterValue}`,
  });
  return supabaseRequest(`/rest/v1/${table}?${params}`, {
    token,
    key: SUPABASE_ANON_KEY,
  });
}

function resultFor(payload, availabilityOrderId) {
  return (payload.results || []).find((row) => row.availability_order_id === availabilityOrderId);
}

function assertResult(payload, availabilityOrderId, outcome, reason) {
  const result = resultFor(payload, availabilityOrderId);
  assert.ok(result, `missing result for availability order ${availabilityOrderId}`);
  assert.equal(result.outcome, outcome);
  if (reason !== undefined) assert.equal(result.reason, reason);
}

async function createDisposableCompanyUser(company, runId, onAuthUserCreated) {
  const email = `ksa-e2e-${runId}@example.invalid`;
  const password = `E2e-${crypto.randomUUID()}-A9!`;
  const authUser = await supabaseRequest('/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email,
      password,
      email_confirm: true,
    },
  });
  onAuthUserCreated(authUser.id);

  await supabaseRequest('/rest/v1/users_profile?on_conflict=id', {
    method: 'POST',
    body: {
      id: authUser.id,
      email,
      role: 'company',
      status: 'approved',
      approved_by: authUser.id,
      approved_at: new Date().toISOString(),
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });

  return { id: authUser.id, email, password, companyId: company.id };
}

async function companyAccessToken(user) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  const payload = await parseResponse(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(`Disposable company login failed: ${payload.error_description || payload.message || response.status}`);
  }
  return payload.access_token;
}

async function cleanupAuditRows(availabilityOrderIds) {
  for (const availabilityOrderId of availabilityOrderIds) {
    const params = new URLSearchParams({
      'details->>availability_order_id': `eq.${availabilityOrderId}`,
    });
    await supabaseRequest(`/rest/v1/admin_actions?${params}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }
}

async function assertTableRowsRemoved(table, ids) {
  if (ids.length === 0) return;
  const params = new URLSearchParams({
    select: 'id',
    id: `in.(${ids.join(',')})`,
  });
  const rows = await supabaseRequest(`/rest/v1/${table}?${params}`);
  assert.deepEqual(rows, [], `${table} cleanup left ${rows.length} row(s)`);
}

async function assertAuditRowsRemoved(availabilityOrderIds) {
  for (const availabilityOrderId of availabilityOrderIds) {
    const params = new URLSearchParams({
      select: 'id',
      'details->>availability_order_id': `eq.${availabilityOrderId}`,
    });
    const rows = await supabaseRequest(`/rest/v1/admin_actions?${params}`);
    assert.deepEqual(rows, [], `admin_actions cleanup left rows for ${availabilityOrderId}`);
  }
}

async function cleanupAuthUser(id) {
  if (!id) return;
  await supabaseRequest(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
}

const jar = new CookieJar();
const runId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const created = {
  batchId: '',
  companyIds: [],
  productIds: [],
  availabilityOrderIds: [],
  authUserIds: [],
};
let testError = null;

try {
  console.log(`Lifecycle fixture ${runId}`);
  console.log('1) Verify anonymous API denial, then log in as admin');
  for (const pathname of [
    '/api/orders',
    '/api/companies',
    '/api/products',
    '/api/order-items?batch_id=00000000-0000-0000-0000-000000000000',
    '/api/availability',
    '/api/purchase-orders',
    '/api/analytics',
    '/api/notifications',
  ]) {
    const response = await fetch(`${BASE_URL}${pathname}`);
    assert.equal(response.status, 401, `anonymous ${pathname} returned ${response.status}`);
  }
  await adminLogin(jar);

  console.log('2) Create two no-email companies and four products');
  const companies = [];
  for (const suffix of ['Complete', 'Partial']) {
    const { json } = await appApi('/api/companies', {
      method: 'POST',
      body: JSON.stringify({ name: `E2E Lifecycle ${suffix} ${runId}` }),
    }, jar);
    companies.push(json.company);
    created.companyIds.push(json.company.id);
  }

  const products = [];
  for (const [companyIndex, company] of companies.entries()) {
    for (let itemIndex = 0; itemIndex < 2; itemIndex += 1) {
      const barcode = `${Date.now()}${companyIndex}${itemIndex}${crypto.randomInt(10, 99)}`;
      const { json: product } = await appApi('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          barcode,
          title: `E2E lifecycle item ${companyIndex + 1}.${itemIndex + 1}`,
          company_id: company.id,
          box_quantity: 5,
          price_per_box: 20 + companyIndex,
        }),
      }, jar);
      products.push(product);
      created.productIds.push(product.id);
    }
  }

  console.log('3) Create the batch and upload four matched items');
  const { json: batch } = await appApi('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      name: `E2E Lifecycle ${runId}`,
      notes: 'Disposable responded/partial/eligible lifecycle fixture',
    }),
  }, jar);
  created.batchId = batch.id;

  const { json: upload } = await appApi('/api/order-items', {
    method: 'POST',
    body: JSON.stringify({
      batch_id: batch.id,
      items: products.map((product, index) => ({
        barcode: product.barcode,
        title: product.title,
        order_qty: 10 + index,
        amazon_cost: 100 + index,
      })),
    }),
  }, jar);
  assert.deepEqual(
    { saved: upload.saved, matched: upload.matched, missing: upload.missing },
    { saved: 4, matched: 4, missing: 0 }
  );
  const rawOrderItems = await supabaseRequest(
    `/rest/v1/order_items?select=amazon_cost&batch_id=eq.${encodeURIComponent(batch.id)}`
  );
  const rawAmazonCost = rawOrderItems.reduce((sum, row) => sum + Number(row.amazon_cost || 0), 0);
  assert.equal(rawAmazonCost, 406);

  console.log('4) Generate availability and create complete/partial response states');
  const { json: generatedAvailability } = await appApi('/api/availability', {
    method: 'POST',
    body: JSON.stringify({ action: 'generate', batch_id: batch.id }),
  }, jar);
  assert.equal(generatedAvailability.created, 2);

  const { json: availabilityList } = await appApi(
    `/api/availability?batch_id=${encodeURIComponent(batch.id)}&include=batch,pos`,
    { method: 'GET' },
    jar
  );
  assert.equal(availabilityList.data.length, 2);
  const completeOrder = availabilityList.data.find((row) => row.company_id === companies[0].id);
  const partialOrder = availabilityList.data.find((row) => row.company_id === companies[1].id);
  assert.ok(completeOrder && partialOrder);
  created.availabilityOrderIds.push(completeOrder.id, partialOrder.id);

  const { json: completeDetails } = await appApi(
    `/api/availability?id=${encodeURIComponent(completeOrder.id)}`,
    { method: 'GET' },
    jar
  );
  assert.equal(completeDetails.data.length, 2);
  const excessiveQuantity = completeDetails.data[0];
  const { status: excessiveQuantityStatus, json: excessiveQuantityResult } = await appApi('/api/availability', {
    method: 'POST',
    body: JSON.stringify({
      action: 'respond',
      availability_order_id: completeOrder.id,
      responses: [{
        id: excessiveQuantity.id,
        is_available: true,
        available_qty: Number(excessiveQuantity.order_item?.order_qty || 0) + 1,
      }],
    }),
  }, jar, { allowFailure: true });
  assert.equal(excessiveQuantityStatus, 400);
  assert.match(excessiveQuantityResult.error, /cannot exceed requested quantity/i);
  await appApi('/api/availability', {
    method: 'POST',
    body: JSON.stringify({
      action: 'respond',
      availability_order_id: completeOrder.id,
      responses: [
        { id: completeDetails.data[0].id, is_available: true, available_qty: 8, comment: 'E2E complete: available' },
        { id: completeDetails.data[1].id, is_available: false, comment: 'E2E complete: unavailable' },
      ],
    }),
  }, jar);

  const { json: partialDetails } = await appApi(
    `/api/availability?id=${encodeURIComponent(partialOrder.id)}`,
    { method: 'GET' },
    jar
  );
  assert.equal(partialDetails.data.length, 2);
  await appApi('/api/availability', {
    method: 'POST',
    body: JSON.stringify({
      action: 'respond',
      availability_order_id: partialOrder.id,
      responses: [
        { id: partialDetails.data[0].id, is_available: true, available_qty: 5, comment: 'E2E partial: available' },
      ],
    }),
  }, jar);

  const { json: responseStates } = await appApi(
    `/api/availability?batch_id=${encodeURIComponent(batch.id)}`,
    { method: 'GET' },
    jar
  );
  assert.equal(responseStates.data.find((row) => row.id === completeOrder.id)?.status, 'responded');
  assert.equal(responseStates.data.find((row) => row.id === partialOrder.id)?.status, 'partially_responded');

  console.log('5) Verify authoritative PO eligibility');
  const { json: completeOnlyPreview } = await appApi('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({ action: 'generate', batch_id: batch.id, dry_run: true }),
  }, jar);
  assert.equal(completeOnlyPreview.created, 0);
  assertResult(completeOnlyPreview, completeOrder.id, 'would_create');
  assertResult(completeOnlyPreview, partialOrder.id, 'skipped', 'not_responded');

  const { json: includePartialPreview } = await appApi('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({
      action: 'generate',
      batch_id: batch.id,
      include_partial: true,
      dry_run: true,
    }),
  }, jar);
  assertResult(includePartialPreview, completeOrder.id, 'would_create');
  assertResult(includePartialPreview, partialOrder.id, 'would_create');

  console.log('6) Generate both POs once, then verify duplicate protection');
  const { status: generationStatus, json: generatedPOs } = await appApi('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({
      action: 'generate',
      batch_id: batch.id,
      include_partial: true,
      po_number: `E2E-${runId}`,
    }),
  }, jar);
  assert.equal(generationStatus, 201);
  assert.equal(generatedPOs.created, 2);
  assertResult(generatedPOs, completeOrder.id, 'created');
  assertResult(generatedPOs, partialOrder.id, 'created');
  const generatedPurchaseOrderIds = generatedPOs.results
    .map((result) => result.purchase_order_id)
    .filter(Boolean);
  assert.equal(generatedPurchaseOrderIds.length, 2);

  const { json: legacyPOList } = await appApi(
    `/api/purchase-orders?batch_id=${encodeURIComponent(batch.id)}`,
    { method: 'GET' },
    jar
  );
  assert.equal(legacyPOList.data.length, 2);
  assert.equal(legacyPOList.count, 2);
  assert.ok(legacyPOList.data.every((po) => po.company?.id && po.availability_order?.batch?.id === batch.id));

  const { json: legacyPOItems } = await appApi(
    `/api/purchase-orders?id=${encodeURIComponent(generatedPurchaseOrderIds[0])}&items=true`,
    { method: 'GET' },
    jar
  );
  assert.ok(legacyPOItems.data.length > 0);
  assert.ok(legacyPOItems.data.every((item) => item.product && item.order_item && 'availability' in item));

  const { json: lifecyclePOs } = await appApi(
    `/api/purchase-orders?view=lifecycle&batch_id=${encodeURIComponent(batch.id)}`,
    { method: 'GET' },
    jar
  );
  assert.equal(lifecyclePOs.data.length, 2);
  assert.equal(lifecyclePOs.count, 2);
  assert.equal(lifecyclePOs.batches.length, 1);
  assert.equal(lifecyclePOs.batches[0].batch.id, batch.id);
  assert.equal(lifecyclePOs.summary.purchase_orders, 2);
  assert.equal(lifecyclePOs.summary.awaiting_confirmation, 2);
  assert.ok(lifecyclePOs.data.every((row) => row.po?.company?.id && row.po?.availability_order?.batch?.id === batch.id));

  const { json: lifecyclePOSummaries } = await appApi(
    `/api/purchase-orders?view=lifecycle&summary_only=true&batch_id=${encodeURIComponent(batch.id)}`,
    { method: 'GET' },
    jar
  );
  assert.deepEqual(lifecyclePOSummaries.data, []);
  assert.equal(lifecyclePOSummaries.count, 2);
  assert.equal(lifecyclePOSummaries.batches.length, 1);
  assert.equal(lifecyclePOSummaries.batches[0].batch.id, batch.id);
  assert.equal('rows' in lifecyclePOSummaries.batches[0], false);
  assert.equal(lifecyclePOSummaries.summary.purchase_orders, 2);
  assert.equal(lifecyclePOSummaries.summary.awaiting_confirmation, 2);

  const { json: analytics } = await appApi(
    `/api/analytics?batch_id=${encodeURIComponent(batch.id)}&page_size=1`,
    { method: 'GET' },
    jar
  );
  assert.equal(analytics.summary.batches, 1);
  assert.equal(analytics.summary.companies, 2);
  assert.equal(analytics.summary.purchase_orders, 2);
  assert.equal(analytics.summary.awaiting_confirmation, 2);
  assert.equal(analytics.summary.requested_items, 4);
  assert.equal(analytics.summary.delivered_qty, 0);
  assert.equal(analytics.batch_performance.length, 1);
  assert.equal(analytics.batch_performance[0].id, batch.id);
  assert.equal(analytics.company_performance.count, 2);
  assert.equal(analytics.company_performance.data.length, 1);
  assert.equal(analytics.company_performance.pages, 2);
  const poItemsForAnalytics = await supabaseRequest(
    `/rest/v1/purchase_order_items?select=total_price&purchase_order_id=in.(${generatedPurchaseOrderIds.join(',')})`
  );
  const expectedOrderedValue = poItemsForAnalytics.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  assert.equal(Number(analytics.summary.ordered_value), Number(expectedOrderedValue.toFixed(2)));
  assert.notEqual(Number(analytics.summary.ordered_value), rawAmazonCost);
  console.log(`Analytics reconciliation: raw Amazon cost ${rawAmazonCost}; ordered supplier value ${expectedOrderedValue.toFixed(2)}`);

  const { status: duplicateStatus, json: duplicates } = await appApi('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({
      action: 'generate',
      batch_id: batch.id,
      include_partial: true,
    }),
  }, jar);
  assert.equal(duplicateStatus, 200);
  assert.equal(duplicates.created, 0);
  assertResult(duplicates, completeOrder.id, 'skipped', 'already_generated');
  assertResult(duplicates, partialOrder.id, 'skipped', 'already_generated');

  console.log('7) Link two disposable company users and validate base-table RLS');
  const companyUsers = [];
  for (const [index, company] of companies.entries()) {
    const companyUser = await createDisposableCompanyUser(
      company,
      `${runId}-${index + 1}`,
      (id) => { created.authUserIds.push(id); }
    );
    await appApi('/api/companies', {
      method: 'PUT',
      body: JSON.stringify({ id: company.id, user_id: companyUser.id }),
    }, jar);
    companyUsers.push(companyUser);
  }

  const companyTokens = await Promise.all(companyUsers.map(companyAccessToken));
  const adminToken = jar.get('sb-access-token');

  for (const [index, token] of companyTokens.entries()) {
    const ownCompany = companies[index];
    const otherCompany = companies[index === 0 ? 1 : 0];

    const visibleCompanies = await restTableRows('companies', 'id', ownCompany.id, token, 'id');
    assert.deepEqual(visibleCompanies.map((row) => row.id), [ownCompany.id]);
    const hiddenCompany = await restTableRows('companies', 'id', otherCompany.id, token, 'id');
    assert.deepEqual(hiddenCompany, []);

    const visibleProducts = await restTableRows('products', 'company_id', ownCompany.id, token, 'id,company_id');
    assert.equal(visibleProducts.length, 2);
    assert.ok(visibleProducts.every((row) => row.company_id === ownCompany.id));
    const hiddenProducts = await restTableRows('products', 'company_id', otherCompany.id, token, 'id');
    assert.deepEqual(hiddenProducts, []);

    const visibleOrderItems = await restTableRows('order_items', 'batch_id', batch.id, token, 'id,company_id');
    assert.equal(visibleOrderItems.length, 2);
    assert.ok(visibleOrderItems.every((row) => row.company_id === ownCompany.id));

    const visibleAvailability = await restTableRows('availability_orders', 'batch_id', batch.id, token, 'id,company_id');
    assert.equal(visibleAvailability.length, 1);
    assert.equal(visibleAvailability[0].company_id, ownCompany.id);

    const visibleResponses = await restTableRows('availability_responses', 'availability_order_id', visibleAvailability[0].id, token, 'id');
    assert.equal(visibleResponses.length, 2);
    const hiddenResponses = await restTableRows(
      'availability_responses',
      'availability_order_id',
      index === 0 ? partialOrder.id : completeOrder.id,
      token,
      'id'
    );
    assert.deepEqual(hiddenResponses, []);

    const visiblePOs = await restTableRows('purchase_orders', 'batch_id', batch.id, token, 'id,company_id');
    assert.equal(visiblePOs.length, 1);
    assert.equal(visiblePOs[0].company_id, ownCompany.id);
    const visiblePOItems = await restTableRows('purchase_order_items', 'purchase_order_id', visiblePOs[0].id, token, 'id');
    assert.ok(visiblePOItems.length > 0);
    const otherPOId = generatedPurchaseOrderIds.find((id) => id !== visiblePOs[0].id);
    const hiddenPOItems = await restTableRows('purchase_order_items', 'purchase_order_id', otherPOId, token, 'id');
    assert.deepEqual(hiddenPOItems, []);
  }

  console.log('8) Validate company-facing API isolation and lifecycle views');
  const companyJars = [new CookieJar(), new CookieJar()];
  await Promise.all(companyUsers.map((user, index) =>
    userLogin(companyJars[index], user.email, user.password)
  ));

  const portalPage = await appPage('/portal', companyJars[0]);
  assert.equal(portalPage.status, 200);
  assert.ok(portalPage.text.includes('Welcome to your Portal'));
  assert.ok(portalPage.durationMs < 1000, `cold company portal response exceeded 1 second (${portalPage.durationMs} ms)`);
  console.log(`Cold company portal response: ${portalPage.durationMs} ms`);

  for (const [index, companyJar] of companyJars.entries()) {
    const ownCompany = companies[index];
    const ownAvailabilityOrder = index === 0 ? completeOrder : partialOrder;
    const otherAvailabilityOrder = index === 0 ? partialOrder : completeOrder;

    const { json: apiAvailability } = await appApi(
      `/api/availability?batch_id=${encodeURIComponent(batch.id)}`,
      { method: 'GET' },
      companyJar
    );
    assert.equal(apiAvailability.data.length, 1);
    assert.equal(apiAvailability.data[0].company_id, ownCompany.id);

    const { json: ownDetails } = await appApi(
      `/api/availability?id=${encodeURIComponent(ownAvailabilityOrder.id)}`,
      { method: 'GET' },
      companyJar
    );
    assert.equal(ownDetails.data.length, 2);

    const { status: crossAvailabilityStatus } = await appApi(
      `/api/availability?id=${encodeURIComponent(otherAvailabilityOrder.id)}`,
      { method: 'GET' },
      companyJar,
      { allowFailure: true }
    );
    assert.equal(crossAvailabilityStatus, 403);

    const { json: apiPOs } = await appApi(
      `/api/purchase-orders?batch_id=${encodeURIComponent(batch.id)}`,
      { method: 'GET' },
      companyJar
    );
    assert.equal(apiPOs.data.length, 1);
    assert.equal(apiPOs.data[0].company_id, ownCompany.id);

    const ownPO = apiPOs.data[0];
    const otherPOId = generatedPurchaseOrderIds.find((id) => id !== ownPO.id);
    const { json: ownPOItems } = await appApi(
      `/api/purchase-orders?id=${encodeURIComponent(ownPO.id)}&items=true`,
      { method: 'GET' },
      companyJar
    );
    assert.ok(ownPOItems.data.length > 0);
    const { json: crossPOItems } = await appApi(
      `/api/purchase-orders?id=${encodeURIComponent(otherPOId)}&items=true`,
      { method: 'GET' },
      companyJar
    );
    assert.deepEqual(crossPOItems.data, []);

    const { status: lifecycleStatus } = await appApi(
      `/api/purchase-orders?view=lifecycle&batch_id=${encodeURIComponent(batch.id)}`,
      { method: 'GET' },
      companyJar,
      { allowFailure: true }
    );
    assert.equal(lifecycleStatus, 403);
  }

  const adminAvailability = await restRows('v_availability_order_progress', batch.id, adminToken);
  assert.equal(adminAvailability.length, 2);
  assert.equal(adminAvailability.find((row) => row.availability_order_id === completeOrder.id)?.response_stage, 'responded');
  assert.equal(adminAvailability.find((row) => row.availability_order_id === partialOrder.id)?.response_stage, 'partial');

  const adminPOs = await restRows('v_purchase_order_progress', batch.id, adminToken);
  assert.equal(adminPOs.length, 2);
  assert.ok(adminPOs.every((row) => row.lifecycle_stage === 'sent'));

  const adminCompanies = await restRows('v_batch_company_lifecycle', batch.id, adminToken);
  assert.equal(adminCompanies.length, 2);
  assert.ok(adminCompanies.every((row) => row.lifecycle_stage === 'awaiting_confirmation'));

  const adminBatches = await restRows('v_batch_lifecycle', batch.id, adminToken);
  assert.equal(adminBatches.length, 1);
  assert.equal(adminBatches[0].lifecycle_stage, 'po_sent');

  for (const [index, companyToken] of companyTokens.entries()) {
    const companyAvailability = await restRows('v_availability_order_progress', batch.id, companyToken);
    assert.equal(companyAvailability.length, 1);
    assert.equal(companyAvailability[0].company_id, companies[index].id);

    const companyPOs = await restRows('v_purchase_order_progress', batch.id, companyToken);
    assert.equal(companyPOs.length, 1);
    assert.equal(companyPOs[0].company_id, companies[index].id);

    const companyLifecycle = await restRows('v_batch_company_lifecycle', batch.id, companyToken);
    assert.equal(companyLifecycle.length, 1);
    assert.equal(companyLifecycle[0].company_id, companies[index].id);

    const companyBatches = await restRows('v_batch_lifecycle', batch.id, companyToken);
    assert.deepEqual(companyBatches, [], 'company callers must not bypass order_batches admin-only RLS');
  }

  console.log('E2E LIFECYCLE SUCCESS');
} catch (error) {
  testError = error;
  console.error('E2E LIFECYCLE FAILED:', error instanceof Error ? error.message : error);
} finally {
  console.log('9) Cleanup disposable records');
  const cleanupErrors = [];
  const cleanup = async (label, action) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : error}`);
    }
  };

  if (created.batchId) {
    await cleanup('batch', () => appApi(
      `/api/orders?id=${encodeURIComponent(created.batchId)}`,
      { method: 'DELETE' },
      jar
    ));
  }
  if (created.availabilityOrderIds.length > 0) {
    await cleanup('admin_actions', () => cleanupAuditRows(created.availabilityOrderIds));
  }
  for (const productId of created.productIds) {
    await cleanup(`product ${productId}`, () => appApi(
      `/api/products?id=${encodeURIComponent(productId)}`,
      { method: 'DELETE' },
      jar
    ));
  }
  for (const companyId of created.companyIds) {
    await cleanup(`company ${companyId}`, () => appApi(
      `/api/companies?id=${encodeURIComponent(companyId)}`,
      { method: 'DELETE' },
      jar
    ));
  }
  for (const authUserId of created.authUserIds) {
    await cleanup(`auth user ${authUserId}`, () => cleanupAuthUser(authUserId));
  }
  await cleanup('batch verification', () => assertTableRowsRemoved(
    'order_batches',
    created.batchId ? [created.batchId] : []
  ));
  await cleanup('product verification', () => assertTableRowsRemoved('products', created.productIds));
  await cleanup('company verification', () => assertTableRowsRemoved('companies', created.companyIds));
  await cleanup('audit verification', () => assertAuditRowsRemoved(created.availabilityOrderIds));

  if (cleanupErrors.length > 0) {
    console.error('Cleanup errors:\n- ' + cleanupErrors.join('\n- '));
    if (!testError) testError = new Error('Fixture assertions passed, but cleanup was incomplete');
  } else {
    console.log('Cleanup complete');
  }
}

if (testError) process.exit(1);
