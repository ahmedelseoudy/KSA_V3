#!/usr/bin/env node
/*
 End-to-end test for Ahmed flow:
 - Logs in as admin
 - Creates a batch
 - Parses the test Excel and uploads items
 - Provisions Ahmed portal user (if missing)
 - Sends availability requests
 - Submits availability responses (as admin session; RLS should permit admin)
 - Generates purchase orders

 Required env:
   BASE_URL (defaults to http://localhost:4321)
   ADMIN_EMAIL
   ADMIN_PASSWORD
   AHMED_EMAIL (defaults to company primary email if set in DB)
 Optional:
   TEST_XLSX (defaults to ./Test_Data/PO#51Z7TZRK.xlsx)
*/

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const BASE_URL = process.env.BASE_URL || process.env.PUBLIC_APP_URL || 'http://localhost:4321';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ksa-crm.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const AHMED_EMAIL = process.env.AHMED_EMAIL || null;
const TEST_XLSX = process.env.TEST_XLSX || path.join(process.cwd(), 'Test_Data', 'PO#51Z7TZRK.xlsx');

if (!ADMIN_PASSWORD) {
  console.error('ERROR: ADMIN_PASSWORD env var is required to run the e2e test.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CookieJar {
  constructor() { this.cookies = new Map(); }
  setFromSetCookie(header) {
    if (!header) return;
    const parts = header.split(',');
    for (const p of parts) {
      const seg = p.split(';')[0].trim();
      const [k, v] = seg.split('=');
      if (k && v) this.cookies.set(k, v);
    }
  }
  header() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function adminLogin(jar) {
  const form = new URLSearchParams();
  form.set('email', ADMIN_EMAIL);
  form.set('password', ADMIN_PASSWORD);
  const resp = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
  });
  const setCookie = resp.headers.get('set-cookie');
  jar.setFromSetCookie(setCookie || '');
  if (resp.status !== 302 && resp.status !== 200) throw new Error(`Login failed: ${resp.status}`);
}

async function api(pathname, options = {}, jar) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (jar) headers.Cookie = jar.header();
  const resp = await fetch(`${BASE_URL}${pathname}`, Object.assign({}, options, { headers }));
  const text = await resp.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!resp.ok) throw new Error(`${pathname} ${resp.status}: ${json.error || text}`);
  return json;
}

function pickCol(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
    const lower = k.toLowerCase();
    const found = Object.keys(row).find((rk) => rk.toLowerCase() === lower);
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') return row[found];
  }
  return null;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const cleaned = String(v).replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function extractItemsFromXlsx(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const items = rows.map((row) => {
    const rawBarcode = pickCol(row, [
      'barcode', 'Barcode', 'BARCODE',
      'External ID', 'external id', 'external_id', 'EXTERNAL ID',
      'EAN', 'ean', 'Ean',
      'SKU', 'sku', 'Sku',
      'Product Code', 'product code', 'product_code',
    ]);
    if (!rawBarcode) return null;
    let barcode = '';
    if (typeof rawBarcode === 'number') barcode = rawBarcode.toFixed(0);
    else barcode = String(rawBarcode);
    barcode = barcode.replace(/[\,\s]/g, '').trim();
    if (!barcode || barcode === '0') return null;

    const orderQty = parseNumber(pickCol(row, [
      'order_qty', 'Order_Qty', 'ORDER_QTY',
      'Quantity', 'quantity', 'QUANTITY', 'Qty', 'qty', 'QTY',
      'Quantity Requested', 'quantity requested', 'QUANTITY REQUESTED',
      'Order Quantity', 'order quantity', 'ORDER QUANTITY',
      'Ordered', 'ordered', 'ORDERED',
    ]));

    const asin = String(pickCol(row, [
      'asin', 'ASIN', 'Asin',
      'Item Code', 'item code', 'item_code', 'ITEM CODE',
      'itemcode', 'ItemCode', 'ITEMCODE',
    ]) || '');

    const title = String(pickCol(row, [
      'title', 'Title', 'TITLE',
      'ItemDescEn', 'itemdescen', 'ITEMDESCEN',
      'Item Description', 'item description', 'ITEM DESCRIPTION',
      'description', 'Description', 'DESCRIPTION',
      'Product Name', 'product name', 'PRODUCT NAME',
      'Name', 'name', 'NAME',
    ]) || '');

    const amazonCost = parseNumber(pickCol(row, [
      'total cost', 'Total Cost', 'TOTAL COST',
      'total_cost', 'Total_Cost', 'TOTAL_COST',
      'amazon_cost', 'Amazon Cost', 'AMAZON COST',
      'Amazon_Cost', 'AMAZON_COST',
      'cost', 'Cost', 'COST',
      'Price', 'price', 'PRICE',
      'Unit Price', 'unit price', 'UNIT PRICE',
      'Amount', 'amount', 'AMOUNT',
    ]));

    return { barcode, order_qty: orderQty, asin, title, amazon_cost: amazonCost };
  }).filter(Boolean);
  return items;
}

(async () => {
  const jar = new CookieJar();
  console.log('1) Logging in as admin ...');
  await adminLogin(jar);

  console.log('2) Creating batch ...');
  const batchName = `Ahmed Test Batch ${new Date().toISOString().slice(0,10)}`;
  const batch = await api('/api/orders', { method: 'POST', body: JSON.stringify({ name: batchName, notes: 'E2E Ahmed run' }) }, jar);
  const batchId = batch.id;
  console.log('   Batch ID:', batchId);

  console.log('3) Parsing test Excel:', TEST_XLSX);
  if (!fs.existsSync(TEST_XLSX)) throw new Error(`Test XLSX not found at ${TEST_XLSX}`);
  const items = extractItemsFromXlsx(TEST_XLSX);
  console.log('   Items parsed:', items.length);

  console.log('4) Uploading items ...');
  const up = await api('/api/order-items', { method: 'POST', body: JSON.stringify({ batch_id: batchId, items }) }, jar);
  console.log('   Upload result:', up);

  console.log('5) Ensuring Ahmed company exists ...');
  const companies = await api('/api/companies?search=Ahmed', { method: 'GET' }, jar);
  const ahmed = (companies.data || []).find((c) => (c.name || '').toLowerCase() === 'ahmed');
  if (!ahmed) throw new Error('Company "Ahmed" not found. Create it in the UI first.');

  if (!ahmed.user_id) {
    console.log('   Provisioning portal user for Ahmed ...');
    const prov = await api('/api/companies/provision-user', { method: 'POST', body: JSON.stringify({ company_id: ahmed.id, email: AHMED_EMAIL || 'ahmed@example.com' }) }, jar);
    console.log('   Provision:', prov);
  } else {
    console.log('   Ahmed already has a linked portal user.');
  }

  console.log('6) Sending availability requests ...');
  const avail = await api('/api/availability', { method: 'POST', body: JSON.stringify({ action: 'generate', batch_id: batchId }) }, jar);
  console.log('   Availability created:', avail.created, 'emails_sent:', avail.emails_sent);

  console.log('7) Fetching availability orders ...');
  const aoList = await api(`/api/availability?batch_id=${batchId}`, { method: 'GET' }, jar);
  const aoAhmed = (aoList.data || []).find((ao) => (ao.company?.name || '').toLowerCase() === 'ahmed');
  if (!aoAhmed) throw new Error('No availability order created for Ahmed (check product matching).');

  console.log('8) Loading Ahmed responses and marking available ...');
  const aoItems = await api(`/api/availability?id=${aoAhmed.id}`, { method: 'GET' }, jar);
  const responses = (aoItems.data || []).map((r) => ({ id: r.id, is_available: true, comment: 'E2E OK' }));
  const respSave = await api('/api/availability', { method: 'POST', body: JSON.stringify({ action: 'respond', availability_order_id: aoAhmed.id, responses }) }, jar);
  console.log('   Responses saved:', respSave.updated);

  console.log('9) Generating purchase orders ...');
  const poNum = `E2E-PO-${Date.now()}`;
  const poGen = await api('/api/purchase-orders', { method: 'POST', body: JSON.stringify({ action: 'generate', batch_id: batchId, po_number: poNum }) }, jar);
  console.log('   POs created:', poGen.created, 'emails_sent:', poGen.emails_sent);

  console.log('\nE2E SUCCESS');
  console.log('- Batch:', batchName, batchId);
  console.log('- Upload:', up);
  console.log('- Availability:', avail.created, 'orders');
  console.log('- Ahmed responses updated:', respSave.updated);
  console.log('- POs created:', poGen.created);
})();
