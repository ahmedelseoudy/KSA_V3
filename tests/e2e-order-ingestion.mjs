#!/usr/bin/env node
/*
 Disposable order-ingestion QA fixture:
 - rejects malformed JSON and invalid rows
 - reports a zero-match upload clearly
 - proves sequential and concurrent retries replace instead of append
 - proves a failed database replacement rolls back to the prior rows
 - blocks replacement after availability starts
 - imports and replaces 5,000 rows while keeping exact totals
 - removes every disposable record in finally
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
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [line.slice(0, separator).trim(), value];
      })
  );
}

const dotEnv = loadDotEnv();
const env = (name, fallback = '') => process.env[name] || dotEnv[name] || fallback;
const BASE_URL = env('BASE_URL', 'http://localhost:4321').replace(/\/$/, '');
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
      if (separator > 0) this.cookies.set(segment.slice(0, separator), segment.slice(separator + 1));
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
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function appRequest(pathname, { method = 'GET', body, rawBody, headers = {} } = {}, jar, allowFailure = false) {
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  if (rawBody !== undefined && !requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
  requestHeaders.set('Cookie', jar.header());
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: requestHeaders,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await parseResponse(response);
  if (!response.ok && !allowFailure) {
    throw new Error(`${pathname} ${response.status}: ${json.error || json.raw || 'request failed'}`);
  }
  return { status: response.status, json };
}

async function adminLogin(jar) {
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    body: new URLSearchParams({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    redirect: 'manual',
  });
  jar.setFromResponse(response);
  assert.ok([200, 302].includes(response.status));
  assert.ok(jar.get('sb-access-token'));
}

async function serviceRows(table, params = {}) {
  const search = new URLSearchParams({ select: '*', ...params });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${search}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const json = await parseResponse(response);
  if (!response.ok) throw new Error(`Supabase ${table}: ${json.message || json.error || response.status}`);
  return json;
}

async function exactCount(table, params = {}) {
  const search = new URLSearchParams({ select: 'id', ...params });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${search}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!response.ok) throw new Error(`Supabase count ${table} returned ${response.status}`);
  const contentRange = response.headers.get('content-range') || '';
  const total = Number(contentRange.split('/')[1]);
  assert.ok(Number.isFinite(total), `missing exact count in ${contentRange}`);
  return total;
}

async function directRpc(name, body, token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await parseResponse(response) };
}

const jar = new CookieJar();
const runId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const created = { batchIds: [], productIds: [], companyId: '' };
let testError = null;

function matchedItems(barcode, count) {
  return Array.from({ length: count }, (_, index) => ({
    barcode,
    title: `Atomic ingestion row ${index + 1}`,
    order_qty: (index % 20) + 1,
    amazon_cost: 100 + (index % 7),
  }));
}

try {
  console.log(`Order ingestion fixture ${runId}`);
  console.log('1) Log in and create disposable company/product');
  await adminLogin(jar);
  const { json: companyResult } = await appRequest('/api/companies', {
    method: 'POST', body: { name: `E2E Ingestion ${runId}` },
  }, jar);
  created.companyId = companyResult.company.id;
  const barcode = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
  const { json: product } = await appRequest('/api/products', {
    method: 'POST',
    body: {
      barcode,
      title: `E2E ingestion product ${runId}`,
      company_id: created.companyId,
      box_quantity: 5,
      price_per_box: 20,
    },
  }, jar);
  created.productIds.push(product.id);

  const createBatch = async (suffix) => {
    const { json: batch } = await appRequest('/api/orders', {
      method: 'POST', body: { name: `E2E Ingestion ${suffix} ${runId}` },
    }, jar);
    created.batchIds.push(batch.id);
    return batch;
  };

  console.log('2) Reject malformed JSON, empty payloads, and invalid rows');
  const edgeBatch = await createBatch('Edges');
  const malformed = await appRequest('/api/order-items', {
    method: 'POST', rawBody: '{not-json',
  }, jar, true);
  assert.equal(malformed.status, 400);
  assert.match(malformed.json.error, /valid JSON/i);
  const empty = await appRequest('/api/order-items', {
    method: 'POST', body: { batch_id: edgeBatch.id, items: [] },
  }, jar, true);
  assert.equal(empty.status, 400);
  const invalid = await appRequest('/api/order-items', {
    method: 'POST', body: { batch_id: edgeBatch.id, items: [{ barcode: '', order_qty: 'bad' }] },
  }, jar, true);
  assert.equal(invalid.status, 400);
  assert.match(invalid.json.error, /Row 1/);

  console.log('3) Save a zero-match upload with an explicit warning');
  const zeroMatch = await appRequest('/api/order-items', {
    method: 'POST',
    body: { batch_id: edgeBatch.id, items: [{ barcode: `missing-${runId}`, order_qty: 1, amazon_cost: 10 }] },
  }, jar);
  assert.deepEqual(
    { saved: zeroMatch.json.saved, matched: zeroMatch.json.matched, missing: zeroMatch.json.missing },
    { saved: 1, matched: 0, missing: 1 }
  );
  assert.match(zeroMatch.json.warning, /No uploaded barcodes matched/i);

  console.log('4) Replace sequential and concurrent duplicate submissions');
  const hundredItems = matchedItems(barcode, 100);
  const first = await appRequest('/api/order-items', {
    method: 'POST', body: { batch_id: edgeBatch.id, items: hundredItems },
  }, jar);
  assert.equal(first.json.saved, 100);
  assert.equal(first.json.replaced, 1);
  const sequential = await appRequest('/api/order-items', {
    method: 'POST', body: { batch_id: edgeBatch.id, items: hundredItems },
  }, jar);
  assert.equal(sequential.json.saved, 100);
  assert.equal(sequential.json.replaced, 100);
  const concurrent = await Promise.all([
    appRequest('/api/order-items', { method: 'POST', body: { batch_id: edgeBatch.id, items: hundredItems } }, jar),
    appRequest('/api/order-items', { method: 'POST', body: { batch_id: edgeBatch.id, items: hundredItems } }, jar),
  ]);
  assert.ok(concurrent.every((result) => result.json.saved === 100 && result.json.replaced === 100));
  assert.equal(await exactCount('order_items', { batch_id: `eq.${edgeBatch.id}` }), 100);

  console.log('5) Prove failed replacement rolls back and downstream batches are locked');
  const failedRpc = await directRpc('replace_order_batch_items', {
    p_batch_id: edgeBatch.id,
    p_items: [{ barcode, order_qty: 1, match_status: 'invalid-status' }],
  }, jar.get('sb-access-token'));
  assert.ok(failedRpc.status >= 400);
  assert.equal(await exactCount('order_items', { batch_id: `eq.${edgeBatch.id}` }), 100);

  const { json: generated } = await appRequest('/api/availability', {
    method: 'POST', body: { action: 'generate', batch_id: edgeBatch.id },
  }, jar);
  assert.equal(generated.created, 1);
  const locked = await appRequest('/api/order-items', {
    method: 'POST', body: { batch_id: edgeBatch.id, items: matchedItems(barcode, 2) },
  }, jar, true);
  assert.equal(locked.status, 409);
  assert.match(locked.json.error, /draft status/i);
  assert.equal(await exactCount('order_items', { batch_id: `eq.${edgeBatch.id}` }), 100);

  console.log('6) Import and safely replace 5,000 rows');
  const scaleBatch = await createBatch('Scale');
  const fiveThousand = matchedItems(barcode, 5000);
  const startedAt = performance.now();
  const scale = await appRequest('/api/order-items', {
    method: 'POST', body: { batch_id: scaleBatch.id, items: fiveThousand },
  }, jar);
  const firstDurationMs = Math.round(performance.now() - startedAt);
  assert.deepEqual(
    { saved: scale.json.saved, matched: scale.json.matched, missing: scale.json.missing },
    { saved: 5000, matched: 5000, missing: 0 }
  );
  assert.equal(await exactCount('order_items', { batch_id: `eq.${scaleBatch.id}` }), 5000);
  const batchRows = await serviceRows('order_batches', { id: `eq.${scaleBatch.id}`, select: 'total_items,total_value' });
  assert.equal(batchRows[0].total_items, 5000);

  const retryStartedAt = performance.now();
  const scaleRetry = await appRequest('/api/order-items', {
    method: 'POST', body: { batch_id: scaleBatch.id, items: fiveThousand },
  }, jar);
  const retryDurationMs = Math.round(performance.now() - retryStartedAt);
  assert.equal(scaleRetry.json.saved, 5000);
  assert.equal(scaleRetry.json.replaced, 5000);
  assert.equal(await exactCount('order_items', { batch_id: `eq.${scaleBatch.id}` }), 5000);
  console.log(`5,000 rows: first ${firstDurationMs} ms; replacement ${retryDurationMs} ms`);

  console.log('E2E ORDER INGESTION SUCCESS');
} catch (error) {
  testError = error;
  console.error('E2E ORDER INGESTION FAILED:', error instanceof Error ? error.message : error);
} finally {
  console.log('7) Cleanup disposable records');
  const cleanupErrors = [];
  for (const batchId of created.batchIds) {
    try {
      await appRequest(`/api/orders?id=${encodeURIComponent(batchId)}`, { method: 'DELETE' }, jar);
    } catch (error) {
      cleanupErrors.push(`batch ${batchId}: ${error instanceof Error ? error.message : error}`);
    }
  }
  for (const productId of created.productIds) {
    try {
      await appRequest(`/api/products?id=${encodeURIComponent(productId)}`, { method: 'DELETE' }, jar);
    } catch (error) {
      cleanupErrors.push(`product ${productId}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (created.companyId) {
    try {
      await appRequest(`/api/companies?id=${encodeURIComponent(created.companyId)}`, { method: 'DELETE' }, jar);
    } catch (error) {
      cleanupErrors.push(`company ${created.companyId}: ${error instanceof Error ? error.message : error}`);
    }
  }

  try {
    assert.equal(await exactCount('order_batches', { id: `in.(${created.batchIds.join(',')})` }), 0);
    assert.equal(await exactCount('products', { id: `in.(${created.productIds.join(',')})` }), 0);
    if (created.companyId) assert.equal(await exactCount('companies', { id: `eq.${created.companyId}` }), 0);
  } catch (error) {
    cleanupErrors.push(`verification: ${error instanceof Error ? error.message : error}`);
  }

  if (cleanupErrors.length > 0) {
    console.error('Cleanup errors:\n- ' + cleanupErrors.join('\n- '));
    if (!testError) testError = new Error('Fixture assertions passed, but cleanup was incomplete');
  } else {
    console.log('Cleanup complete');
  }
}

if (testError) process.exit(1);
