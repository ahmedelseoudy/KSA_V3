# KSA V3 — Full CRM System Plan

## Goal (one sentence)
Transform the existing client-side order processing tool into a database-backed CRM where admin uploads orders, companies get portals to respond to availability requests and confirm purchase orders, with delivery tracking and full business analytics.

---

## 1. Problem & Value

| Dimension | Current State | Target State |
|-----------|--------------|--------------|
| **Data persistence** | localStorage only — lost on clear | Supabase DB, all orders/history retained |
| **Company interaction** | Admin emails ZIP files manually | Companies login to their portal, mark availability, confirm POs |
| **Availability tracking** | None — admin tracks manually | System compares responses, flags unavailable items across vendors |
| **Delivery tracking** | None | Per-PO delivery status with partial delivery support |
| **Analytics** | Basic charts on uploaded file | Full business dashboard: profit/loss, company performance, product trends |

---

## 2. User Roles

| Role | Access |
|------|--------|
| **super_admin** | Everything: user mgmt, all orders, all companies, analytics, system settings |
| **admin** | All orders, generate availability/PO, view analytics, manage companies |
| **company** | Own dashboard only: respond to availability orders, view POs, confirm deliveries |

---

## 3. Database Schema (New Tables)

### 3.1 `companies`
Stores vendor/supplier companies that receive availability orders and POs.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT UNIQUE | Company name (matched from database file) |
| email | TEXT | Primary contact email |
| additional_emails | TEXT[] | CC emails for notifications |
| phone | TEXT | |
| address | TEXT | |
| contact_person | TEXT | |
| user_id | UUID FK → auth.users | Login account for the company portal |
| status | TEXT | active, inactive, suspended |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 3.2 `products`
Master product database (replaces the "database file" upload).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| barcode | TEXT UNIQUE | EAN / product code |
| asin | TEXT | Amazon ASIN |
| title | TEXT | Product name |
| company_id | UUID FK → companies | Supplier |
| box_quantity | INTEGER | Units per box |
| price_per_box | NUMERIC | Cost price per box |
| category | TEXT | Optional grouping |
| status | TEXT | active, discontinued |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 3.3 `order_batches`
A batch represents one upload/processing session (e.g., "March 2025 Order").

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | Batch name / PO reference |
| po_number | TEXT | |
| created_by | UUID FK → auth.users | Admin who created it |
| status | TEXT | draft, availability_sent, po_sent, partially_delivered, completed, cancelled |
| total_items | INTEGER | |
| total_value | NUMERIC | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 3.4 `order_items`
Individual items within an order batch (from the "order file" upload).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| batch_id | UUID FK → order_batches | |
| product_id | UUID FK → products (nullable) | NULL if not matched |
| barcode | TEXT | From order file |
| asin | TEXT | From order file |
| title | TEXT | From order file |
| company_id | UUID FK → companies (nullable) | Resolved from products |
| order_qty | INTEGER | Quantity requested |
| boxes | NUMERIC | Calculated: order_qty / box_quantity |
| amazon_cost | NUMERIC | From order file |
| amazon_cost_after_rebate | NUMERIC | Calculated: amazon_cost * 0.95 |
| provider_cost | NUMERIC | Calculated: boxes * price_per_box |
| profit_loss | NUMERIC | Calculated |
| profit_loss_pct | NUMERIC | Calculated |
| match_status | TEXT | matched, missing |
| created_at | TIMESTAMPTZ | |

### 3.5 `availability_orders`
One per company per batch — the availability request sent to a company.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| batch_id | UUID FK → order_batches | |
| company_id | UUID FK → companies | |
| status | TEXT | pending, partially_responded, responded, expired |
| sent_at | TIMESTAMPTZ | When email notification was sent |
| responded_at | TIMESTAMPTZ | |
| total_items | INTEGER | |
| available_count | INTEGER | How many marked as available |
| unavailable_count | INTEGER | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

### 3.6 `availability_responses`
Per-item response from a company.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| availability_order_id | UUID FK → availability_orders | |
| order_item_id | UUID FK → order_items | |
| is_available | BOOLEAN | NULL = not yet responded |
| available_qty | INTEGER | May differ from requested |
| comment | TEXT | Company's note |
| responded_at | TIMESTAMPTZ | |

### 3.7 `purchase_orders`
Actual PO sent to a company after availability is confirmed.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| batch_id | UUID FK → order_batches | |
| company_id | UUID FK → companies | |
| po_number | TEXT | |
| status | TEXT | draft, sent, confirmed, partially_delivered, delivered, cancelled |
| total_amount | NUMERIC | |
| total_items | INTEGER | |
| sent_at | TIMESTAMPTZ | |
| confirmed_at | TIMESTAMPTZ | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

### 3.8 `purchase_order_items`
Line items in a PO.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| purchase_order_id | UUID FK → purchase_orders | |
| order_item_id | UUID FK → order_items | |
| product_id | UUID FK → products | |
| quantity | INTEGER | Ordered qty |
| boxes | NUMERIC | |
| price_per_box | NUMERIC | |
| total_price | NUMERIC | |
| delivered_qty | INTEGER | Default 0, updated on delivery |
| delivery_status | TEXT | pending, partial, delivered |
| delivery_notes | TEXT | |
| delivered_at | TIMESTAMPTZ | |

### 3.9 `notifications`
Email/in-app notifications log.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| recipient_id | UUID FK → auth.users | |
| company_id | UUID FK → companies (nullable) | |
| type | TEXT | availability_request, po_sent, delivery_reminder, etc. |
| subject | TEXT | |
| body | TEXT | |
| status | TEXT | pending, sent, failed |
| sent_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

---

## 4. Pages / Routes

### Admin Pages (existing, enhanced)
| Route | Purpose |
|-------|---------|
| `/` | Dashboard home — overview cards, quick actions |
| `/orders` | Order batches list — create new, view history |
| `/orders/[id]` | Single order batch — items, status, generate availability/PO |
| `/products` | Product database — upload bulk, add single, search, edit |
| `/companies` | Company management — list, create, edit, credentials |
| `/companies/[id]` | Company detail — orders, availability, POs, deliveries |
| `/availability` | Availability tracker — cross-company comparison, unavailable items |
| `/purchase-orders` | All POs — status tracking |
| `/deliveries` | Delivery tracking — per PO, per company |
| `/analytics` | Full business analytics dashboard |
| `/admin` | User management (existing) |

### Company Portal Pages
| Route | Purpose |
|-------|---------|
| `/portal` | Company dashboard — pending actions, recent activity |
| `/portal/availability/[id]` | Respond to availability order (mark Y/N per item) |
| `/portal/purchase-orders` | View POs, confirm receipt |
| `/portal/purchase-orders/[id]` | PO detail with delivery confirmation |

### Auth Pages (existing)
| Route | Purpose |
|-------|---------|
| `/login` | Login for both admin and company users |
| `/register` | Invite-based registration |

---

## 5. Key Workflows

### 5.1 Upload Product Database
1. Admin uploads Excel/CSV with columns: barcode, company, box_qty, price
2. System parses → upserts into `products` table
3. Auto-creates `companies` entries for new company names
4. Admin can also add/edit products one by one

### 5.2 Process Order Batch
1. Admin uploads order file (Excel/CSV)
2. System matches each item against `products` table by barcode
3. Calculates: boxes, amazon_cost_after_rebate, provider_cost, profit/loss
4. Saves as `order_batch` + `order_items`
5. Shows results table (like current UI)

### 5.3 Generate Availability Orders
1. Admin clicks "Send Availability Requests" on an order batch
2. System groups items by company → creates `availability_orders`
3. Each company gets email notification with link to portal
4. Companies login → mark each item as available (Y/N) with optional qty + comment
5. Admin sees real-time availability status

### 5.4 Availability Analysis
1. Admin views cross-company availability matrix
2. System shows: which items are available from which companies
3. Highlights items unavailable from ALL companies
4. Admin can download unavailable items list
5. Admin can compare prices across available companies

### 5.5 Generate Purchase Orders
1. Admin selects available items → generates POs per company
2. System creates `purchase_orders` + `purchase_order_items`
3. Companies get email notification
4. Companies can login to view/confirm PO

### 5.6 Delivery Tracking
1. Admin or company updates `delivered_qty` per PO item
2. Supports partial delivery (delivered < ordered)
3. System tracks delivery status per PO and per item
4. Admin sees delivery overview across all companies

### 5.7 Analytics
1. Full dashboard with:
   - Revenue, profit, loss by time period
   - Company performance ranking
   - Product performance (top sellers, worst margins)
   - Availability rate by company (reliability score)
   - Delivery rate by company
   - Trend charts over time
2. Optional: AI-powered insights via Gemini/OpenAI API

---

## 6. Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | Supabase (existing) | Already configured, RLS for security |
| Email | Supabase Edge Functions + Resend API | Serverless, scales with Supabase |
| Company auth | Same Supabase auth, role = 'company' | Simplest, reuses existing system |
| File processing | Keep existing XLSX parser | Works well, just save results to DB |
| Charts | Chart.js (existing) | Already integrated |
| AI insights | OpenAI/Gemini API (optional Phase 7) | Can summarize trends, suggest actions |
| Deployment | Vercel (existing) | Already configured |

---

## 7. Implementation Phases

### Phase 0: Cleanup (now)
- Remove 20+ debug/test/setup files from root
- Remove 6 debug pages from src/pages
- Clean up hardcoded mock user in index.astro

### Phase 1: Database Schema
- Create all tables via Supabase migrations
- Set up RLS policies
- Create indexes

### Phase 2: Core Data Layer
- TypeScript types for all entities
- Supabase client functions (CRUD)
- API endpoints for orders, products, companies

### Phase 3: Admin Order Management
- Product database page (upload + CRUD)
- Order batch creation (upload → process → save)
- Refactor existing file processing to save to DB

### Phase 4: Company Portal
- Add 'company' role to auth system
- Company creation with auto-generated credentials
- Portal pages: dashboard, availability response, PO view
- Email notifications via Edge Functions

### Phase 5: Availability Analysis
- Cross-company availability comparison page
- Unavailable items aggregation
- Download functionality for unavailable items

### Phase 6: Delivery Tracking
- Delivery status per PO item
- Partial delivery editing
- Delivery dashboard

### Phase 7: Analytics
- Business analytics dashboard
- Products, companies, profit/loss analysis
- Optional AI-powered insights

---

## 8. Files to Delete (Phase 0)

### Root-level debug/setup scripts
- approve-user.js
- check-and-workaround.js
- create-missing-profile.js
- debug-login.js
- direct-db-setup.js
- direct-sql-exec.js
- execute-setup.js
- final-setup.js
- fix-table-structure.sql
- fix-user-profile.js
- fix-user-profiles.js
- fixed-setup.sql
- manual-setup.sql
- rest-api-setup.js
- set-password.js
- setup-complete-database.js
- setup-database.js
- supabase-mcp-server.js
- temp_settings.json
- test-auth.js
- test-browser-login.js
- test-login.js
- test-mcp-server.js

### Debug pages (src/pages/)
- basic-debug.astro
- debug-auth.astro
- debug-logs.astro
- simple-login.astro
- simple-test.astro
- working-login.astro

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large migration, app breaks | High | Phase-by-phase, keep existing pages working until replaced |
| Company users confused by portal | Medium | Simple, clear UI; email includes direct links |
| Email deliverability | Medium | Use Resend (good reputation); add fallback in-app notifications |
| Data migration from localStorage | Low | One-time; provide import tool |
| Supabase free tier limits | Medium | Monitor usage; optimize queries; upgrade if needed |
