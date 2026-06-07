# KSA CRM

A database-backed supplier CRM that replaces the old Excel/ZIP workflow. Built with **Astro 4 SSR**, **Supabase**, and **Tailwind CSS** — deployed as a standalone Node.js server on **Render.com**.

---

## ✨ Features

| Module | What it does |
|---|---|
| **Admin Dashboard** | Overview cards: orders, revenue, fulfillment % |
| **Companies** | Invite supplier companies; system auto-creates their Supabase auth user |
| **Products** | Bulk XLSX upload or single-item add |
| **Orders** | Upload Amazon order file → auto-match by barcode → grouped availability requests |
| **Availability** | Cross-company pivot; download "unavailable items" as XLSX |
| **Purchase Orders** | Auto-generated per company; emailed via Resend |
| **Deliveries** | Companies report partial quantities in-app |
| **Analytics** | Profit/loss, fulfillment %, top companies |
| **Supplier Portal** | `/portal` — companies confirm availability, POs, and deliveries without a spreadsheet |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Astro 4](https://astro.build) (SSR / standalone Node) |
| UI | [React 18](https://react.dev) islands + [Tailwind CSS 3](https://tailwindcss.com) |
| Database / Auth | [Supabase](https://supabase.com) (Postgres + Row Level Security) |
| Email | [Resend](https://resend.com) via Supabase Edge Functions |
| Charting | [Chart.js 4](https://www.chartjs.org) |
| Excel I/O | [xlsx](https://sheetjs.com) + [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style) |
| Deployment | [Render.com](https://render.com) (Web Service, Node 20) |

---

## 🚀 Local Development

### Prerequisites

- Node.js ≥ 20
- A [Supabase](https://supabase.com) project with the schema applied (see `database-schema.sql`)

### Setup

```sh
# 1. Clone the repo
git clone https://github.com/ahmedelseoudy/KSA_V3.git
cd KSA_V3

# 2. Install dependencies
npm install

# 3. Create your env file
cp .env.example .env
# Fill in the values (see Environment Variables section below)

# 4. Start the dev server
npm run dev
```

The app will be available at **http://localhost:4321**.

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# App URL (no trailing slash)
PUBLIC_APP_URL=http://localhost:4321

# Email via Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=KSA CRM <onboarding@resend.dev>
```

> **Never commit `.env`** — it is listed in `.gitignore`.

---

## 🏗️ Project Structure

```text
/
├── public/                # Static assets (favicon, images)
├── src/
│   ├── components/        # Shared UI components (.astro + React)
│   ├── layouts/           # Page shell layouts
│   ├── lib/               # DB helpers, auth utilities, Supabase clients
│   │   └── db/            # Per-table query functions
│   ├── middleware/        # Auth & session middleware
│   ├── pages/
│   │   ├── api/           # REST API endpoints
│   │   ├── portal/        # Supplier-facing portal
│   │   └── *.astro        # Admin pages
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Helpers (navigation, exports, …)
├── supabase/              # Edge Functions & migrations
├── astro.config.mjs
├── render.yaml            # Render.com deployment blueprint
└── package.json
```

---

## 🔄 Order → Delivery Process Overview

This is the end-to-end flow implemented in the app, from uploading a batch to delivery tracking.

1) Create an Order Batch (status: draft)
   - Page: Orders → + New Order Batch → enter name/PO/notes.
   - API: POST /api/orders → inserts into `order_batches`.

2) Upload Orders file into the batch
   - Page: Orders → for a draft batch, click Upload Orders.
   - The XLSX parser extracts columns even if headers vary (Quantity, Qty, Order_Qty, Total Cost, Price, EAN/SKU/External ID, etc.).
   - Barcodes are normalized (including fixing Excel scientific notation) before upload.
   - API: POST /api/order-items
     - Loads all products (paged) and matches by `barcode`.
     - For matched items: computes boxes, provider cost, P&L, assigns `company_id` and `product_id`.
     - Updates the batch totals: `total_items`, `total_value`.

3) Review Batch Items
   - Page: Orders → View Items → tabs for All / Matched / Unmatched.
   - You’ll see per-item P&L and company attribution.

4) Send Availability Requests (status: availability_sent)
   - Action: Send Availability Requests (creates one availability order per company in the batch with matched items).
   - API: POST /api/availability { action: 'generate' }
     - Creates `availability_orders` rows (per company) and `availability_responses` (per item per company).
     - Updates the batch to `availability_sent`.
     - Emails each company with a portal link to respond.

5) Company Responds in the Portal
   - Page: Company Portal → Availability.
   - Company marks items Available/Unavailable (bulk mark helpers included).
   - API: POST /api/availability { action: 'respond' } updates response rows and the `availability_orders` status.

6) Generate Purchase Orders (status: po_sent)
   - Action: Generate Purchase Orders → enter a PO number.
   - API: POST /api/purchase-orders { action: 'generate' }
     - Creates `purchase_orders` and `purchase_order_items` using available quantities.
     - Sets batch status to `po_sent`.
     - Emails each company their PO.

7) Delivery Tracking and Completion
   - API: POST /api/purchase-orders { action: 'update_delivery' }
     - Updates delivered quantities and sets PO status to `partially_delivered` or `delivered`.
   - Batch-level finalization can be derived from its POs (optional automation).

---

## 🧪 Ahmed End‑to‑End Test Walkthrough

This walkthrough uses the sample Excel you uploaded and the “Ahmed” company to validate the full flow.

Prerequisites
- “Ahmed” exists in Companies and has a primary email set.
- The four Ahmed products are present (barcodes: 6285009002338, 6287013830266, 8051732622840, 8057457190947).
- Email delivery is configured via `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env`.

Steps
1) Create a new batch: Orders → + New Order Batch (e.g., “Ahmed Test Batch”).
2) Upload orders file: click Upload Orders on the new batch and select your XLSX.
   - Confirm items matched for Ahmed and P&L values look realistic.
   - Use the View Items modal filters (Company and P&L) to focus on Ahmed and see totals at the bottom.
3) Send Availability Requests: click the button on the batch card.
   - Ahmed will receive an email with a portal link (if email is configured).
4) Respond as Ahmed:
   - Complete the portal setup from the invite email if needed.
   - Navigate to Portal → Availability → Respond to items (mark available/unavailable) → Save Responses.
5) Generate Purchase Orders: back on Orders, click Generate Purchase Orders and enter a PO number.
   - Ahmed receives a PO email and can view it in the portal.
6) Track Deliveries: optionally update delivered quantities via the Deliveries/PO workflow.

Troubleshooting
- If Ahmed has no portal user yet, go to Companies → Ahmed → Resend Invite (or use the new admin API to provision) to send the setup email.
- If emails don’t arrive, verify `RESEND_API_KEY` and check `/api/*` responses or server logs.

---

## 🧞 Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production bundle to `./dist/` |
| `npm start` | Run the compiled server (`dist/server/entry.mjs`) |
| `npm run preview` | Preview the production build locally |

---

## ☁️ Deploy to Render

See the [full deployment guide](#-render-deployment-guide) below, or use the blueprint:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ahmedelseoudy/KSA_V3)

---

## 📋 Render Deployment Guide

### Step 1 — Create a new Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Web Service**.
2. Connect your GitHub account and select the **`KSA_V3`** repository.

### Step 2 — Configure the service

| Setting | Value |
|---|---|
| **Name** | `ksa-crm` (or anything you prefer) |
| **Region** | Frankfurt / Oregon / Singapore — your choice |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (for testing) → Starter for production |

> Render auto-detects `render.yaml` in the repo root. If you use **Blueprint**, all settings above are pre-filled — you only need to add secrets.

### Step 3 — Add Environment Variables

In **Environment → Environment Variables**, add:

| Key | Value |
|---|---|
| `PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (**keep secret**) |
| `PUBLIC_APP_URL` | `https://ksa-crm.onrender.com` (your Render URL) |
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | `KSA CRM <onboarding@resend.dev>` |

### Step 4 — Deploy

Click **Create Web Service**. Render will:
1. Clone the repo.
2. Run `npm install && npm run build`.
3. Start the server with `npm start`.

First build typically takes **2–3 minutes**. Subsequent deploys are faster.

### Step 5 — Update Supabase Auth settings

In your Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://ksa-crm.onrender.com`
- **Redirect URLs**: `https://ksa-crm.onrender.com/**`

This ensures magic links and invite emails redirect to your live app.

---

## 🗄️ Database Setup

Apply the schema to your Supabase project:

```sh
# Option A — paste into Supabase SQL editor
cat database-schema.sql

# Option B — use the Supabase CLI
supabase db push
```

Then create the super-admin user in **Authentication → Users → Invite user** (or via the `fix-rls.sql` script included in the repo).

---

## 🔒 Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is only used server-side in `/api/*` endpoints — never exposed to the browser.
- All client reads go through Supabase RLS policies.
- Row Level Security is enabled on every table (see `database-schema.sql`).

---

## 📄 License

Private — All rights reserved © 2026 KSA.

---

## 🧩 UI/UX Enhancements (June 2026)

- **Sortable, paginated tables**
  - Purchase Orders and Availability tables now support client-side sorting (click headers) and pagination (rows per page: 10/20/50/100).
  - Sort indicators are shown on the active column as ▲ (ascending) or ▼ (descending).
  - Sticky filter bars and table headers improve usability during scroll.

- **Reusable UI components**
  - `src/components/ui/PageHeader.astro` for consistent page titles and action slots.
  - `src/components/ui/StatCard.astro` for KPI cards with optional live value binding via `valueId`.

- **Navigation**
  - Admin: added `Comparison` to see cross-order analytics.
  - Company Portal: added `Deliveries` (read-only) in the sidebar.

Notes for devs: Sorting and pagination state are maintained in `window.__PO_STATE__` and `window.__AV_STATE__`. When adding new sortable columns, set the `data-sort`/`data-avsort` attribute on the header and include a `<span class="sort" data-key="...">` for the indicator.
