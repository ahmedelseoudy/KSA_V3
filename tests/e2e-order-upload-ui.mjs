#!/usr/bin/env node
/* Browser regression for Orders upload feedback. Uses Chrome DevTools directly
   so the project does not need an additional browser-test dependency. */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ksa-crm.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
if (!ADMIN_PASSWORD) {
  console.error('ERROR: ADMIN_PASSWORD is required.');
  process.exit(1);
}

const debugPort = 9345;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksa-v3-upload-ui-'));
const corruptPath = path.join(tempDir, 'corrupt.xlsx');
const emptyPath = path.join(tempDir, 'empty.csv');
const missingPath = path.join(tempDir, 'zero-match.csv');
fs.writeFileSync(corruptPath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
fs.writeFileSync(emptyPath, '');
fs.writeFileSync(missingPath, `barcode,order_qty,total cost\nmissing-ui-${Date.now()},1,10\n`);

const chrome = spawn(CHROME_PATH, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${path.join(tempDir, 'profile')}`,
  'about:blank',
], { stdio: 'ignore' });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function debuggerPage() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === 'page');
      if (page) return page;
    } catch {}
    await delay(100);
  }
  throw new Error('Chrome debugging endpoint did not start');
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      const waiters = this.waiters.get(message.method) || [];
      this.waiters.delete(message.method);
      for (const resolve of waiters) resolve(message.params || {});
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method) {
    return new Promise((resolve) => {
      const waiters = this.waiters.get(method) || [];
      waiters.push(resolve);
      this.waiters.set(method, waiters);
    });
  }
  close() { this.socket.close(); }
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result?.value;
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
}

async function waitFor(cdp, expression, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function chooseFileAndUpload(cdp, filePath) {
  const node = await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('ordersFileInput')`,
  });
  assert.ok(node.result?.objectId, 'orders file input not found');
  await cdp.send('DOM.setFileInputFiles', {
    files: [filePath],
    objectId: node.result.objectId,
  });
  await evaluate(cdp, `document.getElementById('ordersFileInput').dispatchEvent(new Event('change', { bubbles: true }))`);
  await evaluate(cdp, `document.getElementById('startOrdersUpload').click()`);
  await waitFor(cdp, `!document.getElementById('ordersUploadResult').classList.contains('hidden')`, 60000);
  return evaluate(cdp, `document.getElementById('ordersUploadResult').innerText`);
}

let cdp;
let batchId = '';
let testError = null;
try {
  const page = await debuggerPage();
  cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  console.log('1) Sign in and create a disposable draft batch');
  await navigate(cdp, `${BASE_URL}/login`);
  const loginLoaded = cdp.once('Page.loadEventFired');
  await evaluate(cdp, `(() => {
    document.getElementById('email').value = ${JSON.stringify(ADMIN_EMAIL)};
    document.getElementById('password').value = ${JSON.stringify(ADMIN_PASSWORD)};
    document.getElementById('loginForm').requestSubmit();
  })()`);
  await loginLoaded;
  assert.ok(!(await evaluate(cdp, 'location.pathname')).includes('/login'));

  const batch = await evaluate(cdp, `fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Upload UI ${Date.now()}' })
  }).then(async response => ({ ok: response.ok, body: await response.json() }))`);
  assert.equal(batch.ok, true);
  batchId = batch.body.id;

  await navigate(cdp, `${BASE_URL}/orders`);
  await waitFor(cdp, `typeof window.openUpload === 'function'`);

  console.log('2) Show a safe parsing error for a corrupted XLSX');
  await evaluate(cdp, `window.openUpload(${JSON.stringify(batchId)})`);
  const corruptMessage = await chooseFileAndUpload(cdp, corruptPath);
  assert.match(corruptMessage, /Unsupported ZIP file|Failed to parse file/i);

  console.log('3) Reject an empty spreadsheet with actionable guidance');
  await evaluate(cdp, `window.openUpload(${JSON.stringify(batchId)})`);
  const emptyMessage = await chooseFileAndUpload(cdp, emptyPath);
  assert.match(emptyMessage, /No valid rows found.*barcode column/i);

  console.log('4) Render the zero-match upload as a warning, not success');
  await evaluate(cdp, `window.openUpload(${JSON.stringify(batchId)})`);
  const zeroMatchMessage = await chooseFileAndUpload(cdp, missingPath);
  assert.match(zeroMatchMessage, /nothing matched/i);
  assert.match(zeroMatchMessage, /No uploaded barcodes matched/i);

  console.log('E2E ORDER UPLOAD UI SUCCESS');
} catch (error) {
  testError = error;
  console.error('E2E ORDER UPLOAD UI FAILED:', error instanceof Error ? error.message : error);
} finally {
  if (cdp && batchId) {
    try {
      const cleanup = await evaluate(cdp, `fetch('/api/orders?id=${encodeURIComponent(batchId)}', { method: 'DELETE' })
        .then(async response => ({ ok: response.ok, body: await response.text() }))`);
      assert.equal(cleanup.ok, true, cleanup.body);
      console.log('Cleanup complete');
    } catch (error) {
      console.error('Cleanup failed:', error instanceof Error ? error.message : error);
      if (!testError) testError = error;
    }
  }
  cdp?.close();
  chrome.kill('SIGTERM');
  await delay(250);
  fs.rmSync(tempDir, { recursive: true, force: true });
}

if (testError) process.exit(1);
