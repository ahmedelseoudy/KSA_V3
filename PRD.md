# KSA CRM — Product Requirements Document

**Status:** Draft v1 · **Owner:** Head of Product (Ahmed) · **Date:** 2026-05-26

---

## 1. Goal (one sentence)

Replace the current localStorage + ZIP-file Excel workflow with a database-backed CRM where the admin orchestrates orders end-to-end and each supplier company self-serves availability, PO confirmation, and partial delivery reporting through their own portal — with email notifications instead of file handoffs.

---

## 2. Problem · Value · Impact · Constraints

**Problem.** Today the admin uploads two Excel files into a browser session, gets matched orders in `localStorage`, then exports availability and PO requests as ZIPs and emails them manually. Companies reply in Excel. Nothing is persisted. There is no cross-batch comparison, no delivery tracking, no audit trail, and no single source of truth.

**Value.**
- **Admin:** one dashboard for every order's lifecycle, real cross-company analytics, no manual file shuffling.
- **Supplier company:** dedicated portal, mark availability per item, confirm POs, edit partial deliveries in-app.
- **Business:** persistent history → analytics on profit/loss, supplier reliability, fulfillment gaps.

**User impact.** Admin shifts from "operate Excel" → "operate workflow." Companies shift from "fill spreadsheet" → "click a link in email and respond in the portal."

**Business impact (metrics to track post-launch).**
- Time from order upload → all availability responses received (target: ≤ 24h).
- % of items with partial delivery captured in DB (target: 100%).
- # of ZIP files exchanged per month (target: 0).

**Constraints.**
- Stack is fixed: Astro 4 SSR + Supabase + Vercel. No framework swaps.
- Single developer + Cascade. MVP must ship in days, not weeks.
- Email delivery requires an external provider — Supabase Auth SMTP only covers auth emails, not transactional. **Resend** is the lowest-friction choice (free tier 3k/mo).
- LLMs are *permitted* but **not required for MVP**. Defer until core data flows.

---

## 3. Facts vs Assumptions

### Facts (verified from codebase)
- DB schema applied to new Supabase project `cbhllxodkfmtgfzeejka`: `companies`, `products`, `order_batches`, `order_items`, `availability_orders`, `availability_responses`, `purchase_orders`, `purchase_order_items`, `notifications`. RLS on, helper fns `is_admin()` / `get_user_company_id()` in place.
- DB-layer functions exist: `@/home/ahmed/Documents/ksa_v3/src/lib/db/companies.ts`, `products.ts`, `orders.ts`, `availability.ts`, `purchase-orders.ts`.
- API endpoints exist: `@/home/ahmed/Documents/ksa_v3/src/pages/api/` (companies, products, orders, order-items, availability, purchase-orders).
- Admin pages built: `@/home/ahmed/Documents/ksa_v3/src/pages/dashboard.astro`, `companies.astro`, `products.astro`, `orders.astro`, `availability.astro`, `purchase-orders.astro`, `deliveries.astro`, `analytics.astro`.
- Company portal pages built: `@/home/ahmed/Documents/ksa_v3/src/pages/portal/index.astro`, `availability.astro`, `purchase-orders.astro`.
- Super admin user created: `admin@ksa-crm.com` / `Admin@KSA2025!`.

### Assumptions (need explicit validation)
- **A1:** All admin pages actually read from the DB end-to-end (not mocked / not localStorage). → Must verify by walking the flow with seed data.
- **A2:** RLS policies allow the company role to do exactly what the portal requires and nothing more. → Need a smoke test as a company user.
- **A3:** Resend (or alternative) is acceptable as the email provider; Ahmed will supply an API key.
- **A4:** Companies receive one shared inbox per company (the `additional_emails[]` field exists but no UI yet) — confirm UI need.
- **A5:** Single-file XLSX upload format is unchanged from the original `fileProcessor.ts` columns.

### Critical gaps vs the requested system (this is the real backlog)
| # | Gap | Impact |
|---|-----|--------|
| G1 | **No email delivery** — `notifications` table is dead writes; no provider, no edge function, no triggers. | Companies never get notified. The whole "instead of ZIP files" promise breaks. |
| G2 | **No company-user invitation flow** — `companies.astro` creates a company row but doesn't create a Supabase auth user, doesn't link `user_id`, doesn't send an invite. | Companies can't actually log in. |
| G3 | **Bulk order upload into DB is missing** — the old `index.astro` still uses `localStorage` + `fileProcessor.ts`; no path that writes a matched batch into `order_batches` / `order_items`. | The DB never gets populated from real files. |
| G4 | **Old/dead surfaces** still routable and visible: `/`, `/po`, `/order-analysis`, `/admin` (parts). Confuse role-based UX. | Demo risk; user already hit this. |
| G5 | **Unavailable-items export across companies** not implemented as a downloadable file. | A core analytics output is missing. |
| G6 | **No end-to-end verification** — nothing has been walked through with real data. | Unknown bugs everywhere. RLS, type mismatches, missing FKs likely. |
| G7 | **`auth.ts` ROLE_HIERARCHY missing `'company'`**, and `page_permissions` table not updated with new routes. | Permission decisions may default-deny or default-admin-only. |

---

## 4. Recommendation

**Build the smallest end-to-end vertical that proves the workflow, then layer features.**

Don't build all surfaces in parallel. Walk one batch from upload → email → response → PO → delivery, fix every bug along that single path, *then* add bulk import polish, multi-email management, and analytics depth.

**Why:** Two of the three biggest risks (email, RLS) only reveal themselves when traversed end-to-end. Building eight admin pages without ever sending an email is what got us here.

### Alternative considered
Build all admin pages first, integrate email last. **Rejected** — that's what's already happened, and we still don't have a working email loop. Repeating it doubles down on the wrong sequence.

---

## 5. Scope

### In scope (MVP)
- Cleanup of dead/old surfaces (G4).
- Company invite flow with auto-created Supabase auth user + company linkage (G2).
- Bulk order upload that lands directly in `order_batches` + `order_items` with product matching (G3).
- Email delivery via Resend through a Supabase Edge Function, triggered when:
  - Availability request is sent to a company.
  - Purchase order is sent to a company. (G1)
- Cross-company unavailable-items report with XLSX download (G5).
- End-to-end smoke test with seed data covering admin + one company (G6).
- Patch role hierarchy + page permissions for `company` role (G7).

### Out of scope (explicitly deferred)
- LLM-powered features (smart matching, NL analytics, email drafting). Add only after core stable.
- In-app real-time chat between admin and company.
- Multi-currency, tax, invoicing.
- Mobile app.
- SSO / Google login.

### Won't do
- Re-architecting to Next.js, NestJS, or any other stack.
- Replacing Supabase Auth.

---

## 6. User flows (MVP)

**Admin happy path**
1. Logs in → `/dashboard`.
2. `/companies` → "Add company" (name, primary email, optional extra emails) → system creates Supabase user, sends invite email with set-password link.
3. `/products` → bulk upload product DB (XLSX) **or** add single product.
4. `/orders` → "New batch" → upload Amazon order file → backend matches by barcode, writes `order_batches` + `order_items`, shows match/missing stats.
5. `/orders/:id` → "Send availability request" → groups items by company → creates `availability_orders` + skeleton `availability_responses` → triggers email per company.
6. Waits. Sees responses arrive in `/availability` (cross-company comparison).
7. `/availability/unavailable` → downloads XLSX of all "not available" items grouped by item barcode, with the list of companies that said no.
8. `/orders/:id` → "Generate POs" → for items with available_qty > 0, creates `purchase_orders` + `purchase_order_items` → triggers PO email per company.
9. `/deliveries` → company reports partial delivery; admin can override `delivered_qty` per item.
10. `/analytics` → totals by company, profit/loss, fulfillment %.

**Company happy path**
1. Receives invite email → sets password → lands on `/portal`.
2. Receives "availability request" email → clicks link → `/portal/availability/:id` → marks each row Available/Not, enters qty if partial → submit.
3. Receives "PO sent" email → clicks link → `/portal/purchase-orders/:id` → confirms.
4. As goods ship, opens the same PO → edits delivered quantity per item → submit. Status auto-rolls up to `partial` / `delivered`.

---

## 7. Functional requirements (deltas only — what's missing)

### F1 — Cleanup
- Delete (or convert to redirect) `@/home/ahmed/Documents/ksa_v3/src/pages/po.astro`, `order-analysis.astro` (old localStorage tool).
- Convert `@/home/ahmed/Documents/ksa_v3/src/pages/index.astro` from the file-processing tool into a router: redirect logged-in admins → `/dashboard`, companies → `/portal`, anonymous → `/login`.
- Remove `'/'` "Process Orders" item from `@/home/ahmed/Documents/ksa_v3/src/utils/navigation/constants.ts`.
- Keep `@/home/ahmed/Documents/ksa_v3/src/pages/admin.astro` only if it's the user-management page; otherwise fold into `/companies`.
- Delete unused old components after grep proves no live references: `FileUpload.astro`, `ResultTable.astro`, `POTable.astro`, `LoadingState.astro`, `ErrorState.astro`, plus `utils/exportUtils.ts`, `downloadUtils.ts`, `fileProcessor.ts`, `po/*` if confirmed dead.

### F2 — Company invitation (G2)
- `POST /api/companies` extends current create to:
  1. Insert company row.
  2. Call `supabase.auth.admin.inviteUserByEmail(primary_email)` (needs `SUPABASE_SERVICE_ROLE_KEY` on server).
  3. Update `users_profile` for the new user: `role='company'`, `status='approved'`.
  4. Set `companies.user_id` to the new user's id.
- UI: `/companies` "Add Company" modal shows resulting invite-link status. "Resend invite" action on row menu.
- Add `additional_emails` input (chips UI) — accepted by API, stored as text[].

### F3 — Bulk order ingestion (G3)
- New page: `/orders/new` (replaces old `/`):
  - Two file inputs: products DB file (optional, only if updating), Amazon order file (required).
  - "Create batch" → POSTs both files to `/api/orders/ingest`.
- New API: `POST /api/orders/ingest`
  - Parse via existing `fileProcessor.ts` logic (server-side, lift it out of browser).
  - Match each order line against `products` by barcode.
  - Insert `order_batches` row, then bulk insert `order_items` with `company_id`, costs, `match_status`.
  - Return batch id + counts.
- Single-item add stays on `/products`.

### F4 — Email delivery (G1)
- Add `RESEND_API_KEY` to env.
- Deploy Supabase Edge Function `send-notification`:
  - Input: `{ notification_id }`.
  - Reads `notifications` row, fetches related company emails (primary + `additional_emails`), builds HTML from a template (availability request | PO sent), sends via Resend, updates `notifications.status` to `sent` or `failed`.
- API endpoints that "send availability" and "send PO" must:
  1. Insert `notifications` row(s) with `status='pending'`.
  2. Invoke the edge function (fire-and-forget, log failures).
- Templates: 2 plain HTML files in repo (`/supabase/functions/send-notification/templates/`).

### F5 — Unavailable items report (G5)
- `/availability/unavailable?batch_id=...` page already exists per the file list — verify it shows pivot of "items × companies who said no."
- Add "Download XLSX" button → server-side generator using `xlsx`, no JSZip needed.

### F6 — Permissions cleanup (G7)
- `@/home/ahmed/Documents/ksa_v3/src/lib/auth.ts` `ROLE_HIERARCHY`: add `'company': 1` (same level as user but distinct path).
- Seed `page_permissions` rows for the new routes (`/companies`, `/products`, `/orders`, `/availability`, `/purchase-orders`, `/deliveries`, `/analytics` → admin) and (`/portal`, `/portal/*` → user/company).

---

## 8. Non-functional requirements

- **Security:** Service-role key never reaches the browser; only used in `/api/*` server endpoints and edge functions. All client reads go through RLS.
- **Performance:** bulk insert order items in chunks of 500; aim < 3s for a 5k-row order file.
- **Observability:** every email send logs to `notifications.status` and to edge function logs. Admin dashboard shows last 10 failed notifications.
- **Recoverability:** "Resend" action on every email-triggering surface.

---

## 9. Phased plan (smallest viable slices)

| Phase | Days | Outcome | Validation gate |
|------|------|---------|-----------------|
| **P0 — Cleanup** | 0.5 | Old pages removed, nav clean, `index.astro` is a router, role hierarchy patched. | Dev server boots; logged-in admin lands on `/dashboard`; no link points to `/po` or `/order-analysis`. |
| **P1 — Company invite loop** | 1 | Admin creates a company → company user receives Supabase invite email → sets password → lands on `/portal`. | Manual smoke test with a real test inbox. |
| **P2 — Bulk order ingestion** | 1 | Upload XLSX → `order_batches` + `order_items` populated → visible in `/orders/:id`. | Row counts match file; match_status correct for known barcodes. |
| **P3 — Transactional email** | 1 | Resend wired, edge function deployed, availability+PO emails actually land. | Trigger from `/orders/:id` "Send availability" → company inbox has email with portal link. |
| **P4 — Company response + delivery edits** | 1 | Company marks availability, admin confirms unavailable export, PO sent, partial delivery captured. | Walk full lifecycle on seed data; counts roll up correctly. |
| **P5 — Analytics polish** | 0.5 | `/analytics` reflects real data: profit/loss, top companies, fulfillment %. | Visual review against known seed totals. |
| **P6 — QA pass** | 0.5 | Edge cases, permission tests, rollback note. | Checklist below all green. |

**Total MVP estimate:** ~5 dev days.

---

## 10. Role-owned tasks (handoff format)

| Owner | Task | Inputs | Deliverable | Acceptance | Risks |
|-------|------|--------|-------------|-----------|-------|
| **CTO** | Approve email provider (Resend) + key management strategy | Cost/scale numbers | Decision recorded in this PRD | Key in `.env` only; never in repo | Provider rate limits |
| **Backend** | `/api/orders/ingest` server-side parser | Existing `fileProcessor.ts` | New endpoint, chunked inserts | 5k rows < 3s, idempotent on retry | Memory blow-up on huge files |
| **Backend** | Extend `/api/companies` with invite + user link | Service role key | Updated route | New company → user row + email | Auth admin API quota |
| **Backend** | Edge function `send-notification` | Resend key, templates | Deployed function | Triggered + status updated | Email deliverability |
| **Frontend** | Replace `index.astro` with router | Auth context | Lean redirect file | No old upload UI rendered | Auth race conditions |
| **Frontend** | `/orders/new` page | `/api/orders/ingest` | Working upload UI | Shows match stats post-ingest | UX for big files |
| **Frontend** | "Add Company" modal with chips for extra emails | F2 contract | Updated modal | Validation + invite status | Email format validation |
| **Frontend** | "Download XLSX" on unavailable report | Server-side endpoint | Button + endpoint | File matches table | Sheet sizing |
| **API Expert** | Resend integration in edge fn | Provider docs | Working send + retry | Bounce handled gracefully | Domain SPF/DKIM |
| **DevOps** | Add `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to Vercel + Supabase secrets | Provider dashboards | Secrets set, no leakage | Build green, no key in source | Key rotation plan |
| **QA** | E2E checklist execution | Seed script | Pass/fail report | All P-gates green | Time pressure to skip |

---

## 11. QA / Testing bar

Must cover before MVP is "done":
- **Happy path:** admin uploads → emails sent → company responds → PO sent → company confirms → partial delivery → analytics updated.
- **Edge cases:** order file with 0 matches; company has zero items in batch; availability response with available_qty > ordered.
- **Failure states:** Resend down → notification status stays `pending`, retry works; supabase invite fails → company row not orphaned (transaction or compensating delete).
- **Permissions:** company A cannot read company B's POs (RLS test with two real company users); anonymous cannot read `/api/*`.
- **Integration failures:** edge function timeout, malformed XLSX, duplicate barcode.
- **Performance:** 5k-row order ingest under 3s; portal page open under 1s on cold session.
- **Analytics validation:** sum of order_items.amazon_cost in DB == sum in `/analytics` cards for a given batch.
- **Rollback:** if a batch ingest crashes mid-insert, no orphan rows (wrap in a transaction or delete batch on failure).

---

## 12. Risks (top 5, ranked)

1. **Email deliverability + domain reputation.** New Resend domain → likely spam folder. *Mitigation:* set up SPF/DKIM on day 1; use a verified test domain; show in UI when a notification went to spam (bounce webhook later).
2. **RLS misconfigurations.** Easy to over-restrict and break the portal, or under-restrict and leak data. *Mitigation:* write a 10-minute test that logs in as a fake company user via the API and asserts visibility.
3. **Scope creep into LLM features.** Tempting but unvalidated. *Mitigation:* explicitly out of MVP scope (see §5).
4. **Bulk ingest performance.** XLSX parsing in Node is slow for >10k rows. *Mitigation:* stream + chunk inserts; add upper bound (reject files > 20k rows for MVP).
5. **Auth invite UX.** Supabase invite emails are bare; companies may ignore them. *Mitigation:* customize the Supabase invite template subject/body to mention "KSA CRM."

---

## 13. Success metrics (first 30 days)

- ≥ 80% of availability requests answered without admin chasing.
- 0 ZIP files sent.
- 100% of POs have a `delivered_qty` recorded within 14 days of being sent.
- Time admin spends per batch reduced ≥ 50% vs Excel workflow (self-reported).

---

## 14. Decisions log

| # | Question | Decision | Date |
|---|---------|---------|------|
| 1 | Email provider | **Resend** | 2026-05-26 |
| 2 | Sending domain | TBD — start with Resend `onboarding@resend.dev` for tests, switch to real domain before launch | open |
| 3 | Company onboarding | **Admin-only invites** (no self-register) | 2026-05-26 |
| 4 | Unavailable report layout | **Two sheets**: per-item summary + per-company tabs | 2026-05-26 |
| 5 | Locale / currency | TBD — defaulting to USD + en-US until told otherwise | open |

---

## 15. What I will NOT do without explicit approval

- Add any LLM dependency.
- Touch the existing auth tables in destructive ways.
- Change the Supabase project or org.
- Auto-publish emails to real company addresses during testing (will use test inbox until you say go).

---

**Next step if approved:** I start P0 (cleanup) immediately and surface diffs for you before moving to P1.
