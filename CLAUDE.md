# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on localhost:4321
npm run build      # Build production bundle to ./dist/
npm start          # Run compiled server (dist/server/entry.mjs)
npm run preview    # Preview production build locally
npm run test:e2e:lifecycle  # Disposable response/PO/lifecycle/RLS fixture
npm run test:e2e:ingestion  # Disposable malformed/retry/rollback/5k import fixture
npm run test:e2e:upload-ui  # Headless Chrome XLSX/zero-match feedback fixture
```

Install with `npm install --legacy-peer-deps` (required due to peer dep conflicts).

There is no unit test suite. `tests/e2e-ahmed.mjs` is a standalone end-to-end script (login → create batch → upload XLSX → send availability → generate PO) run against a live dev server:
```bash
BASE_URL=http://localhost:4321 ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... node tests/e2e-ahmed.mjs
```

`tests/e2e-lifecycle-fixture.mjs` is the repeatable regression fixture for the Phase 1/2 boundary. It creates two no-email companies, four products, and two independent company users; produces one complete and one partial availability response; verifies default and `include_partial` PO eligibility; generates both POs once; verifies `already_generated`; and checks base-table RLS, company-facing APIs, cross-company detail denial, and all four migration-007 views for both company identities. It removes the batch/products/companies/audit rows/Auth users in `finally` and queries the database afterward to prove cleanup. It requires `ADMIN_PASSWORD`; the Supabase URL, anon key, and service-role key may come from `.env`:
```bash
BASE_URL=http://localhost:4321 ADMIN_PASSWORD=... npm run test:e2e:lifecycle
```

`tests/e2e-order-ingestion.mjs` covers malformed JSON/rows, a zero-match file, sequential and concurrent duplicate submissions, database-error rollback, upload locking after availability begins, and a 5,000-row first import plus identical retry with enforced sub-three-second assertions. `tests/e2e-order-upload-ui.mjs` drives headless Chrome through corrupted XLSX, empty spreadsheet, and zero-match warning states without adding a browser-test dependency. Both create only disposable records and verify cleanup:
```bash
BASE_URL=http://localhost:4321 ADMIN_PASSWORD=... npm run test:e2e:ingestion
BASE_URL=http://localhost:4321 ADMIN_PASSWORD=... npm run test:e2e:upload-ui
```

## Architecture

**Astro 4 SSR monolith** with React islands, backed by Supabase (Postgres + Auth + RLS). Deployed to Render.com.

### Request Flow

Every request passes through `src/middleware.ts`, which:
1. Restores session from `sb-access-token` / `sb-refresh-token` cookies
2. Redirects unauthenticated users to `/login`
3. Hard-blocks `company` role users from admin pages — they can only access `/portal`, `/api`, and static assets

### Page Structure

- `src/pages/` — Admin-facing pages (dashboard, orders, products, companies, availability, purchase-orders, deliveries, analytics, comparison)
- `src/pages/portal/` — Supplier portal (availability responses, PO confirmation, delivery reporting)
- `src/pages/api/` — Server-side API endpoints (login, logout, companies, products, orders, order-items, availability, purchase-orders, users, auth/setup-password)
- `src/pages/login.astro`, `register.astro`, `auth/setup.astro`, `waiting-approval.astro` — Auth flow pages

### Data Layer

`src/lib/db/` contains per-table query modules (companies, products, orders, availability, purchase-orders). **Client naming note (corrects an earlier version of this doc):** `src/lib/supabase-server.ts`'s `createAuthenticatedClient`/`createSupabaseServerClient` use the **anon key** plus the request's session cookies — they run as the logged-in user and are subject to RLS. The actual service-role client that bypasses RLS is `supabaseAdmin`, exported from `src/lib/supabase.ts` (null if `SUPABASE_SERVICE_ROLE_KEY` isn't set). Use `supabaseAdmin` for anything that must bypass RLS or call the Supabase Auth Admin API (creating/deleting auth users, `listUsers`, etc.); use `createAuthenticatedClient` for normal per-user reads/writes. Browser-side code uses the anon client from `src/lib/supabase.ts` (the `supabase` export), subject to RLS.

### Auth & Roles

Roles: `super_admin` → `admin` → `company`. Auth state is managed via Supabase Auth tokens stored in httpOnly cookies. The `users_profile` table links auth users to roles and (for company users) to their `companies` row via `companies.user_id`.

`users_profile` columns: `id` (UUID, FK to auth.users), `email`, `role`, `status` (`pending`/`approved`/`suspended`), `invited_by`, `approved_by`, `created_at`, `approved_at`. There is no `full_name` column.

Migration `006_correctness_and_drift.sql` adds the `"Admins can view all profiles"` SELECT policy using `public.is_admin()`. Without it, an authenticated admin sees only their own row through the anon/session client: `/api/users` then misclassifies every other auth account as orphaned, profile updates silently affect zero rows, and attribution embeds cannot resolve other users. `PUT /api/users` also checks the returned row now and reports 404 instead of claiming success when no profile was updated.

**Supabase auto-creates a `users_profile` row via a DB trigger whenever a new `auth.users` row is created** (default `role='user'`, `status='pending'`). Any server-side code that calls `supabaseAdmin.auth.admin.createUser(...)` must **`upsert`** into `users_profile` afterward, not `insert` — an `insert` will fail with `duplicate key value violates unique constraint "users_profile_pkey"` on every call, regardless of email, because the row already exists. This is also why the manual super_admin bootstrap process below uses `UPDATE`, not `INSERT`.

To create a new **super_admin**: create the user in Supabase Dashboard → Authentication → Users, then run in SQL Editor:
```sql
UPDATE public.users_profile
SET role = 'super_admin', status = 'approved', approved_at = NOW(), approved_by = id
WHERE email = 'admin@example.com';
```
To create a regular **admin**, use the "Create Admin" button on `/admin` instead (super_admin only) — it calls `POST /api/users`, which creates the auth user via `supabaseAdmin`, upserts the profile with `role: 'admin'`, and emails a temporary password via Resend. `PUT`/`DELETE` on `/api/users` also check the *target* user's role, not just the requester's, so a plain `admin` can never modify or delete a `super_admin` account.

**Deleting a Supabase auth user requires cleanup first.** `admin_actions.admin_id` and `admin_actions.target_user` reference `auth.users(id)` **without** `ON DELETE CASCADE`. Deleting an auth user (via `supabaseAdmin.auth.admin.deleteUser()`, or directly in the Supabase Dashboard) fails with a generic `"Database error deleting user"` if any `admin_actions` row still references that id. `DELETE /api/users` handles this by clearing those rows first — always delete users through the app's UI/API, not the Supabase Dashboard directly, or you'll hit this. If a user was ever deleted the old way (profile row removed but the auth account left behind), it becomes an orphan with no `users_profile` row; `GET /api/users` surfaces these with a synthetic `status: 'orphaned'` entry so they still show up in `/admin` and can be deleted properly.

Company invitation flow: Admin creates company → sends invite email (Resend via `src/lib/email.ts`) → company clicks setup link → `POST /api/auth/setup-password` creates Supabase auth user and links it to the company.

### Database

Supabase-hosted Postgres. Migrations live in `supabase/migrations/`. Key helper RPCs defined in `001_crm_schema.sql`:
- `get_all_products_for_matching()` — paginated product lookup for XLSX order-item matching (SECURITY DEFINER to work across companies)
- `create_company_user()` — creates Supabase auth user for a company
- `keep_alive_ping()` — called by GitHub Actions cron every 3 days to prevent free-tier auto-pause

**After running DDL (new columns/constraints) in the SQL Editor, PostgREST's schema cache may not pick it up immediately** — an embed like `select=..., foo:other_table!some_fkey(...)` can fail with `"Could not find a relationship between ... in the schema cache"` even though the column/FK exists. Run `NOTIFY pgrst, 'reload schema';` in the SQL Editor (or Dashboard → Settings → API → "Reload schema") after any migration that adds a column/FK a PostgREST embed will reference.

### Availability Response Attribution

Some supplier companies can't use the portal themselves — an admin phones them, asks what's available, and enters responses on their behalf. `availability_responses` has `responded_by` (UUID, FK to `users_profile(id)`, `ON DELETE SET NULL`, explicit constraint name `availability_responses_responded_by_fkey` so PostgREST's embed syntax in `src/pages/api/availability.ts` keeps working) and `responded_by_role` (`'company' | 'admin' | 'super_admin'`, a role *snapshot* — not re-derived from the current role of the `responded_by` user — so attribution survives role changes/deletion). Added in `supabase/migrations/004_availability_response_attribution.sql`, which also backfills every pre-existing responded row as `'company'` (no admin write path existed before this migration).

`POST /api/availability` `{action:'respond'}` now accepts `company`, `admin`, or `super_admin` callers (previously any logged-in user with no role check) and stamps `responded_by`/`responded_by_role` from the caller's session on every row it updates — this is last-write-wins, not merge: a company re-submitting after an admin entered data (or vice versa) overwrites the prior attribution. When an admin/super_admin submits, it also logs an `admin_actions` row (`action_type: 'availability_respond_on_behalf'`, `target_user` set to the company's linked portal user if one exists).

`src/pages/availability.astro`'s admin detail view has an "Enter responses on behalf" editor mirroring the portal's respond UI (`src/pages/portal/availability.astro`); its save only submits rows whose value/comment actually changed from what was loaded (`data-orig`/`data-orig-comment`), so opening the editor and clicking Save can't blindly restamp attribution on rows the admin didn't touch — but this check is client-side only, not enforced by the API.

### Purchase Order Confirmation Attribution

Same on-behalf pattern as availability, applied to PO confirmation. `purchase_orders` has `confirmed_by` (UUID, FK to `users_profile(id)`, `ON DELETE SET NULL`, explicit constraint name `purchase_orders_confirmed_by_fkey`) and `confirmed_by_role` (`'company' | 'admin' | 'super_admin'` role snapshot). Added in `supabase/migrations/005_purchase_order_confirmation_attribution.sql`, which backfills every pre-existing confirmed PO (`confirmed_at IS NOT NULL`) as `'company'`.

`POST /api/purchase-orders` `{action:'confirm'}` already allowed admin/super_admin as well as the owning company; it now also stamps `confirmed_by`/`confirmed_by_role` from the caller's session, and when an admin/super_admin confirms, logs an `admin_actions` row (`action_type: 'po_confirm_on_behalf'`, `target_user` set to the company's linked portal user if one exists). The admin `/purchase-orders` page has a "Confirm on behalf" button next to each `sent`-status PO's row actions (the button only existed in `/portal/purchase-orders.astro` before this).

### Purchase Order Generation and Delivery Correctness

Migration `006_correctness_and_drift.sql` reconciles the previously live-only `purchase_orders.availability_order_id` and `delivery_date` columns into migration history and adds a partial unique index on `(batch_id, company_id) WHERE status <> 'cancelled'`. A cancelled PO can be re-issued, but two active POs for one batch/company cannot race into existence.

`POST /api/purchase-orders` `{action:'generate'}` derives the effective batch from selected availability orders, requires selections to share one batch, pre-checks existing active POs, and returns one explicit `results[]` outcome per availability order. It no longer swallows query/insert errors. If PO-item insertion fails, it deletes the just-created empty PO. `{dry_run:true}` evaluates the same eligibility path without inserting rows or sending email. A valid request with zero creations returns HTTP 200; one or more creations returns 201.

Delivery updates preserve the first non-zero `delivered_at` rather than re-stamping it on every note edit, recalculate each affected parent PO only once, allow a PO to move back to `confirmed`/`sent`/`draft` when quantities return to zero, and log `delivery_record` in `admin_actions`. The endpoint remains admin-only. It still has no per-PO company-ownership check; add one before any future company-side delivery write path is introduced.

### Lifecycle Visibility Views

Migration `007_lifecycle_visibility.sql` adds four `security_invoker` views, deriving progress from raw child rows instead of trusting drifting status fields:

- `v_availability_order_progress` — one row per availability order with answered/available/unavailable/unanswered counts and quantities, response stage, first/last responder time, attribution, days waiting, and last activity.
- `v_purchase_order_progress` — one row per PO with ordered/delivered quantities and values, confirmation/delivery stage, `awaiting_confirmation`, `ready_to_schedule`, `is_overdue`, and last activity. It deliberately does not join `order_batches`, whose RLS is admin-only.
- `v_batch_company_lifecycle` — one current row per `(batch_id, company_id)`, using ranked availability/PO rows and a full outer join so unanswered companies with no PO remain visible.
- `v_batch_lifecycle` — one admin-only row per batch (`order_batches.*` plus timestamps, counts, values, `lifecycle_stage`, `stage_index`, `next_action`, and `last_activity_at`).

All four revoke anonymous access and grant read access to authenticated/service-role callers. Existing table RLS remains authoritative: a company JWT sees only its own rows in the first three views and sees zero rows from `v_batch_lifecycle`; admins see all four. This exact contract is exercised by `tests/e2e-lifecycle-fixture.mjs`.

`GET /api/orders` now reads `v_batch_lifecycle`. Because that view starts with `order_batches.*`, the response remains a strict superset for the untouched `/orders` and `/analytics` consumers; writes still target `order_batches`. Reads accept bounded `limit`/`offset`, stored-status filtering, and a whitelisted `sort` of `created_at`, `last_activity_at`, or `name`. `summary=true` adds active-PO, awaiting-confirmation, ready-to-schedule, and overdue totals without the dashboard fetching every PO row.

`src/utils/lifecycle/{types,model,render}.ts` is the shared lifecycle presentation layer. It derives one five-step Created → Availability → Answers → POs sent → Delivered model and renders `compact`, `row`, or `detail` HTML densities with escaped content, semantic ordered steps, complete `aria-label` text, one prioritized warning, and a plain-English next action. `.lc-*` classes in `src/styles/global.css` use theme tokens and include distinct complete/current/upcoming/cancelled states. The dashboard uses the `row` density and sorts its five batches by `last_activity_at`; stored batch status remains visible only as the action-gating status.

`GET /api/purchase-orders?view=lifecycle` is the opt-in admin decision view backed by `v_batch_company_lifecycle`. It returns every batch/company lifecycle row (including companies with no PO), attaches `batch`, and attaches each generated PO as `po` using the exact legacy nested shape. It also returns server-derived global and per-batch summaries for PO count, confirmation/delivery decisions, overdue work, ordered/delivered quantity and value, and fill rate. The default list response and `?id=&items=true` response are intentionally unchanged for Comparison and both portal consumers.

The admin `/purchase-orders` and `/deliveries` pages consume that lifecycle mode and group rows by batch. Purchase Orders keeps silent companies visible and prioritizes the next decision. Deliveries shows only generated, non-cancelled POs and initializes every quantity editor from `delivered_qty`; pending items are no longer prefilled to the full ordered quantity. Delivery saves validate whole-number bounds and submit only rows whose quantity or note changed.

### Excel I/O

XLSX parsing (order uploads, product bulk-import) uses the `xlsx` package. Order-item matching maps barcodes from uploaded files against the `products` table. Barcode parsing handles both string and numeric Excel cell formats.

## Tooling

This repo is indexed by CodeGraph (`.codegraph/` at the repo root, 77 files / 950 nodes / 2,820 edges as of the email-delivery re-index on 2026-07-31). Use `codegraph explore "<symbol or question>"` (or the `codegraph_explore` MCP tool) before grep/find or reading files to locate code or trace call paths — it returns verbatim source plus caller graphs in one call. Re-run `codegraph index` after large structural changes (`codegraph init` only reports an already-initialized project).

## Environment Variables

```
PUBLIC_SUPABASE_URL=          # Supabase project URL
PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY=    # Supabase service role key (server-only, bypasses RLS)
PUBLIC_APP_URL=               # App URL without trailing slash (e.g. http://localhost:4321)
RESEND_API_KEY=               # Resend email API key
RESEND_FROM_EMAIL=            # Sender address (e.g. KSA CRM <onboarding@resend.dev>)
RESEND_WEBHOOK_SECRET=        # Signing secret for /api/webhooks/resend
```

Copy `.env.example` to `.env` for local development.

**Resend sandbox restriction:** the default `RESEND_FROM_EMAIL` (`KSA CRM <onboarding@resend.dev>`) only delivers to the email address that owns the Resend account — any other recipient silently fails in production. To send to real users, verify a custom domain in the Resend dashboard (add the SPF/DKIM DNS records it provides), then set `RESEND_FROM_EMAIL` to an address on that domain. `sendEmail()` (`src/lib/email.ts`) returns `{ ok: false, error }` on failure rather than throwing — callers should surface `error` rather than assuming success.

## Deployment

Production runs on Render.com (`render.yaml`). Build command: `npm install --legacy-peer-deps && npm run build`. Start command: `npm start`. All secrets are set via the Render dashboard — never committed. Env var changes in the Render dashboard trigger an automatic restart; no redeploy needed.

**Host binding gotcha:** `@astrojs/node`'s standalone adapter reads `host` from Astro's top-level `server.host` config (`astro.config.mjs`), **not** from the options passed to `node({...})`. Setting `adapter: node({ host: true })` is silently overwritten by `astro:config:done` and does nothing. The correct fix — already applied — is `server: { host: true }` at the top level of `defineConfig`. Getting this wrong makes the app bind to a non-wildcard address, and Render's deploy port-scan times out with `"No open ports detected on 0.0.0.0"` even though the server logs show it's listening. Setting `HOST=0.0.0.0` as a Render env var only helps if this service was provisioned via a Render Blueprint sync (auto-applies `render.yaml`'s env vars); if it was created manually in the dashboard, that env var may not exist at all, so the code-level fix is the reliable one.

The GitHub Actions workflow `.github/workflows/supabase-keep-alive.yml` pings Supabase every 3 days to prevent free-tier auto-pause. It requires two repository secrets set in GitHub Settings → Secrets & Variables → Actions: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Without these the workflow fails silently and the project will still pause.

## Frontend Design System

The UI supports light and dark themes with per-module accent colors, replacing the old dark-only, single-accent (violet) look. `tailwind.config.mjs` and `src/styles/global.css` are the source of truth.

**Constraint that shaped the approach:** there are no React islands in use today despite `@astrojs/react` being installed — all 20 pages are `.astro` files, and ~15 of them render dynamic UI (tables, badges, modals) via vanilla-JS `innerHTML` template strings, not JSX. Tailwind's `dark:` variant would require duplicating every class in those strings, so theming is implemented via **CSS custom properties**, not `dark:` classes.

**How theming works:** `tailwind.config.mjs` remaps `gray`, `white`, `purple`/`indigo`, and the status colors (`red`/`green`/`yellow`/`blue`/`orange`) plus the module accents (`cyan`/`sky`/`emerald`/`amber`/`fuchsia`/`rose`) to reference CSS variables (`rgb(var(--gray-800) / <alpha-value>)` etc.) defined in `src/styles/global.css` under `:root`/`.dark` and `.light`. Shade pairs invert between themes (300↔700, 400↔600, 500 constant) so an accent that reads as a light tone on a dark card also reads as a dark tone on a light card. Because the remap happens at the Tailwind-config level, every `bg-gray-800`/`text-purple-300`/etc. class — including ones inside `innerHTML` strings — flips with the theme with no page edits. **Exception:** `text-oncolor` (always literal white, `tailwind.config.mjs`) is used instead of `text-white` wherever text sits on a solid brand-color surface (buttons, the "K" logo tile, active tab pills) rather than the neutral surface scale — `text-white` itself is theme-reactive (inverts to near-black in light mode) and would go invisible on a colored button if used there.

**Theme toggle:** `ThemeInit.astro` is an inline no-FOUC script included in both `Layout.astro` and `AuthLayout.astro` `<head>`s; it sets the `dark`/`light` class on `<html>` from `localStorage.theme`, falling back to `prefers-color-scheme`, before first paint. The toggle button (sun/moon icons) lives in `Navigation.astro`'s user-footer, next to sign-out.

**Module accent colors:** `src/utils/navigation/accent-colors.ts` maps each `AccentColor` to complete literal Tailwind class strings (`ACCENT_NAV_ACTIVE`, `ACCENT_NAV_ICON`, `ACCENT_TILE`, `ACCENT_HOVER_TITLE`, `ACCENT_HOVER_BORDER`) — kept as full literal strings, not `` `bg-${accent}-600` `` interpolation, because Tailwind's class scanner works via regex over raw file text and can't see dynamically-constructed names. Each `NavItem` in `src/utils/navigation/constants.ts` has an `accent` field consumed by `Navigation.astro` (active item + icon color) and `dashboard.astro` (quick-action card tiles): Dashboard/Order Batches = violet, Products = cyan, Companies = sky, Availability = emerald, Purchase Orders = amber, Deliveries = orange, Comparison/Analytics = fuchsia, Admin = rose. Status badges (success/warning/danger/info/pending) use soft tinted-bg + ring styling rather than flat `-500` colors.

**Shared component classes:** `src/styles/global.css` defines `@layer components` classes — `.btn` + `.btn-md`/`.btn-sm` + `.btn-primary`/`.btn-secondary`/`.btn-soft-{brand,success,danger}`, `.badge` + `.badge-{success,warning,danger,info,brand,pending}`, `.card`, `.input`, `.table-header-cell`, `.modal-overlay`/`.modal-panel` — matching the shapes already established across the app. The primary/secondary buttons have been swept across all pages to use `btn btn-primary btn-md` etc. in place of the old repeated inline-utility strings; `StatCard.astro` uses `.card`. Prefer these over ad hoc inline utility strings when adding new UI — the soft-tinted action-button variants (e.g. the red "Delete" buttons) and the per-status pill spans still use their original inline classes in most places and are safe to migrate opportunistically.

**Currency:** All stored monetary values represent Saudi riyals. Use `formatCurrency()` from `src/utils/currency.ts` for every UI/email amount; it renders explicit `SAR` text with the `en-SA` locale. Do not add `$`, `USD`, or page-local currency formatters. `parseCurrencyInput()` accepts SAR-prefixed imports as well as legacy dollar-prefixed numeric input without converting the value. The shared `StatCard.astro` uses container-relative value sizing because the explicit `SAR` prefix is wider than the former dollar symbol; summary-card grids should use progressive `sm`/`lg`/`xl` breakpoints instead of forcing four to six columns as soon as the desktop sidebar appears.

## Handoff / Open Items (as of 2026-07-31)

**Availability response attribution — DONE.** Merged to `main` (merge commit `0218859`, feature commit `a7de2f5`) and pushed to `origin/main`. Migration `004_availability_response_attribution.sql` is applied to the live Supabase DB (`cbhllxodkfmtgfzeejka`) and schema-cache-reloaded — verified end-to-end (admin respond-on-behalf → correct `responded_by`/`responded_by_role` stamping, order recalc, `admin_actions` audit row). See "Availability Response Attribution" above for the feature itself.

**Production down scare — resolved, was a wrong URL.** The prior session tested `https://ksa-crm.onrender.com` (404, bare Express "Cannot GET /") and thought the deploy was broken. The actual production URL is `https://ksa-v3.onrender.com` — confirmed working 2026-07-28 (`/` → 302 redirect as expected for an unauthenticated request, `/login` → 200). No deploy issue existed; `ksa-crm.onrender.com` is just not this service (never was, or a stale/unrelated Render service).

**Purchase Order confirmation attribution — DONE.** Migration `005_purchase_order_confirmation_attribution.sql` is live; code was committed and pushed to `main` in `327c8c4`. See "Purchase Order Confirmation Attribution" above.

**v3.1 Phase 0 correctness — DONE and deployed.** Committed as `3c0c99d` and pushed to `main`; migration `006_correctness_and_drift.sql` is applied to live Supabase and schema-cache-reloaded. In addition to the API checks above, an isolated production smoke test used a disposable no-email company/product/batch: product matching and availability creation worked, first PO generation created the PO, a repeated generation reported `already_generated`, confirmation worked, `delivered_at` stayed stable across a note edit, and resetting quantity restored the PO to `confirmed`. The disposable batch, product, and company were then deleted and their absence verified.

**v3.1 Phase 1 availability redesign — DONE and deployed.** Committed as `5747a51` and pushed to `main`. `/availability` is now grouped into newest-first collapsible batch sections with derived/stored lifecycle state, response progress, per-section sorting/pagination, filters including `expired`, lazy detail rendering, scoped unavailable-item summaries/Excel export, preserved admin respond-on-behalf editing, and `?batch_id=` deep links. PO generation is per batch and gated by the server's authoritative dry run; it uses clear complete-vs-partial choices and inline company-by-company results. The misleading per-company PO button and dead duplicate generation helper were removed. `GET /api/availability?include=batch,pos` adds batch and active-PO context without changing the default portal response. Verification passed with `npm run build`, `npx tsc --noEmit --skipLibCheck`, `git diff --check`, authenticated local/production API checks, and a headless Chrome interaction (50 rows on page 1, correct zero-eligibility message, no runtime/console errors). Production currently has only pending responses, so responded/partial/eligible visual states were verified through logic and the Phase 0 disposable flow, not a retained production fixture.

**v3.1 Phase 2 foundation + dashboard slice — DONE and deployed.** Migration `007_lifecycle_visibility.sql` is applied live and schema-cache-reloaded. Its four security-invoker views were validated with the disposable fixture: admin row counts were 2 availability / 2 PO / 2 company-lifecycle / 1 batch-lifecycle; the temporary company JWT saw only its own 1 / 1 / 1 rows and zero admin-only batch summaries. The fixture also proved full-vs-partial dry-run eligibility, two first-time PO creations, two duplicate `already_generated` results, Auth/profile provisioning, and database-confirmed cleanup. Commit `5fc0038` adds the shared three-density lifecycle renderer/styles, switches `GET /api/orders` to the strict-superset batch view with bounded sort/summary options, replaces the dashboard's unbounded PO-count fetch, and renders five recently active lifecycle rows. Local and production build/type/diff checks, authenticated lifecycle/status-filter regressions for `/api/orders`, `/dashboard`, `/orders`, and `/analytics`, and desktop/mobile headless Chrome checks all passed with no console errors or horizontal overflow.

**v3.1 Phase 2 Purchase Orders + Deliveries slice — DONE and deployed.** Commits `8433994` and `9839223` provide the opt-in lifecycle API, grouped admin Purchase Orders and Deliveries pages, compatibility assertions, safe changed-only quantity editing, and collapsed/lazy batch loading. Both pages now request lightweight batch summaries first, fetch a single batch's company rows on first expansion, cache reopened batches, and preserve Delivery `po_id` deep links. The summary payload measured about 1.2 KB against current data versus about 130 KB for one detailed 48-company batch. The disposable fixture, build, types, API contracts, and desktop/mobile headless interactions all pass.

**v3.1 Phase 3 Lifecycle Analytics — DONE and deployed.** Commit `04f2f06` adds an admin-only `GET /api/analytics` endpoint that replaces the browser's four raw/unbounded API downloads. It filters by batch/company/created date, aggregates lifecycle KPIs server-side, returns batch trends and lifecycle distribution, and sorts/paginates company performance. `/analytics` labels values accurately as ordered/delivered PO value (not revenue/profit), shows response completion, quantity availability, fill rate, unique attention count, batch decisions, filters, charts, and paginated company results. Current-data validation reduced 99 lifecycle rows into 3 batch summaries and 51 company summaries with only the requested company page returned. Company filters, sorting, pagination, desktop/mobile layout, console health, build, types, and the disposable fixture's analytics contract all pass; fixture cleanup is database-confirmed.

**SAR currency standardization + responsive KPI audit — DONE and deployed.** Commit `8d96752` is on `main`/`origin/main`. `src/utils/currency.ts` centralizes explicit `SAR`/`en-SA` formatting and SAR/legacy-dollar import parsing. Admin Orders, Products, Availability, Purchase Orders, Deliveries, Comparison, Analytics, both supplier portal PO/delivery surfaces, and PO email totals use the shared formatter. This is presentation/input parsing only; existing stored values were not converted because they already represent Saudi riyals. The longer currency prefix exposed cramped summary cards, so `StatCard.astro` now sizes values relative to its container and the Admin, Dashboard, Products, Availability, Comparison, Analytics, Purchase Orders, Deliveries, Orders modal, and supplier-portal KPI grids use safer progressive breakpoints. Validation passed with `npx tsc --noEmit --skipLibCheck`, `npm run build`, `git diff --check`, the full disposable lifecycle fixture, an authenticated currency sweep with no `$`/`USD` remnants or runtime errors, and 28 authenticated layout checks across seven principal pages at 320, 390, 768, and 1400 px with no clipped/overflowing KPI values. Production SAR rendering was confirmed by the user on the admin surface on 2026-07-31.

**ABBAR availability detail warning — resolved without a code change.** The admin Availability page briefly showed ABBAR as `13 / 0 / 0 / 0% / pending` with `Failed to load details.` Both ABBAR detail requests were checked locally and in production and returned HTTP 200 with all 13 rows; the page subsequently loaded normally and the user confirmed it was working. Treat this as a transient request incident unless it recurs; if it does, capture the browser Network response and Render request log at the same timestamp before changing the lazy-loading code.

**Email delivery tracking + controlled retries — DONE and deployed.** Commit `3cacf57` is on `main`/`origin/main`, Render serves `/notifications`, migrations `008_email_delivery_tracking.sql` and `011_regenerate_setup_token_grant.sql` are applied live, and the schema cache is reloaded. Every transactional email now creates one notification/Resend message per recipient, uses an idempotency key and `notification_id` tag, and stores the provider message ID. `/api/webhooks/resend` verifies the untouched raw body with Svix HMAC headers, rejects signatures older than five minutes, deduplicates event IDs, and records sent/delivered/delayed/failed/bounced/suppressed/complained outcomes. Admins get `/notifications` with global counts, filters, exact provider errors, and explicit-recipient retries limited to three with a one-minute cooldown. Authenticated admins can regenerate invite tokens during retries. Retry context never stores setup tokens, temporary passwords, or rendered email HTML. Resend webhook `c9c39e6a-5e53-45c7-a237-973f44090aa3` is enabled for the seven production events at `https://ksa-v3.onrender.com/api/webhooks/resend`; its unique signing secret is configured in Render. The original diagnostic recipient `sales@omarna.com` permanently bounced because that mailbox does not exist. Local `RESEND_TEST_EMAIL` and Render's sender were therefore changed to the existing monitored `test@omarna.com` mailbox; Render uses `KSA CRM <test@omarna.com>` (replace it with a more professional monitored mailbox later). The user confirmed receipt. Production validation then sent one tagged disposable message from/to that mailbox: the recipient server accepted it, the signed webhook changed the CRM row to `delivered`, and its notification/webhook event rows were deleted and confirmed absent. The pure signature fixture, disposable live-schema webhook fixture (valid/replay/tampered signature plus database-confirmed cleanup), authenticated notification API/page smoke test, controlled invite failure, retry failure and retry-linking checks, typecheck, build, diff check, and full disposable lifecycle regression also pass.

**Order-ingestion QA, isolation, rollback, and performance — DONE and deployed.** Commits `db65eff` and `803a2cc` are on `main`/`origin/main`; migrations `009_atomic_order_item_import.sql` and `010_server_side_order_matching.sql` are applied live and the schema cache is reloaded. Draft-batch imports are capped at 10,000 validated rows, serialized per batch with an advisory transaction lock, matched in Postgres through a normalized-barcode expression index, and replaced atomically. A database failure rolls the delete/insert back; availability-started batches reject replacement with HTTP 409. A content fingerprint turns an exact completed retry into a verified no-op, while a changed file replaces the prior rows. The Orders modal now reports prior rows replaced, leaves zero-match warnings open in amber instead of showing green success, gives empty-file barcode guidance, and catches corrupt XLSX parsing. The strengthened lifecycle fixture creates two actual company identities and proves company A/B isolation across companies, products, order items, availability orders/responses, POs/items, company APIs, cross-detail requests, and all lifecycle views. Local production-shaped validation passed types, build, diff check, lifecycle/RLS, browser upload feedback, rollback, sequential/concurrent duplicates, downstream locking, and exact-count cleanup. The deployed production fixture passed all ingestion assertions with 5,000 rows in 2,762 ms and an identical retry in 939 ms; all fixture records were deleted and confirmed absent. A brief Render 502 occurred only during the deploy restart before the first production fixture created anything; health returned (root 302/login 200) and the complete rerun passed.

**Remaining PRD QA gates — DONE locally and production-verified.** The lifecycle fixture verifies every tested API rejects anonymous callers with 401, rejects `available_qty` above the requested quantity with 400, and reconciles analytics correctly: raw Amazon cost is tracked separately from ordered supplier value (the disposable batch was `406` raw cost versus `53.00` ordered supplier value). The company portal rendered successfully in cold authenticated requests in `153 ms` locally and `128 ms` against production, both below the one-second target. The expanded `npm run test:e2e:lifecycle` passed locally and on production; all disposable records were cleaned up.

**Product catalog management — DONE and deployed.** Commit `0d9d13a` is on `main`/`origin/main`. `/products` now supports complete catalog administration: validated bulk Excel/CSV import with exact created/updated counts and row-level errors, company auto-creation for previously unseen names, box quantity handling, product editing, summary statistics, and safe escaping of rendered values. Bulk imports resolve companies by exact name; missing names are inserted as active company records without an email or portal user, after which an admin can complete the company profile and provision access from `/companies`. Product API regression checks covered invalid rows, valid create/update behavior, summary output, edit behavior, and disposable cleanup; typecheck, build, and diff checks passed.

**Companies email and portal-user workflow — DONE and deployed.** Commits `95b13aa` and `e0b5c96` are on `main`/`origin/main`. The Companies API now exposes the linked portal user's email when the company's legacy `email` field is empty, so cards and edit forms show the actual login address (including the previously misleading Aanab case). Editing a company email updates contact data only; it does not create a login or send an invite. Superadmins now see a dedicated `Create portal user` action for companies without a linked user, which calls the existing provisioning endpoint and reports whether the invite was sent. Companies with a linked user retain `Resend invite`. Additional emails remain CC recipients and do not create separate logins. The UI helper text and status labels were updated to make this distinction explicit. Typecheck, production build, and diff checks passed.

**Exact next-session sequence:**

1. Replace the temporary monitored sender `KSA CRM <test@omarna.com>` with a professional verified mailbox when one is available.
2. Keep the unrelated untracked `supabase-mcp-setup.txt` out of application commits unless the user explicitly asks to add it.

**Supabase MCP fixed.** It was failing to connect (`ERR_MODULE_NOT_FOUND: zod` from a corrupted npx cache under `~/.npm/_npx/`). Fixed by installing `@supabase/mcp-server-supabase` into a stable directory (`~/.local/share/mcp-servers/supabase`) and repointing the `claude mcp add` registration (local scope, this project dir) at `node .../dist/transports/stdio.js --project-ref=cbhllxodkfmtgfzeejka --read-only` instead of `npx -y ...`. `claude mcp list` shows it Connected. Since it's `--read-only`, DB *writes* (like applying migrations) still went through the Supabase **Management API** directly (`POST https://api.supabase.com/v1/projects/cbhllxodkfmtgfzeejka/database/query` with the PAT) rather than through the MCP server.

## Security Notes

- The service role key must never reach the browser. It is only imported in `src/lib/supabase-server.ts` and API route handlers.
- RLS policies enforce company isolation at the database level, but API routes also check user role before performing sensitive operations.
- `.env`, `CREDENTIALS.md`, `Test_Data/`, and `.xlsx` files are git-ignored. Historical secrets were previously committed — they should be considered rotated.
