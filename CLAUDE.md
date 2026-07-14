# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on localhost:4321
npm run build      # Build production bundle to ./dist/
npm start          # Run compiled server (dist/server/entry.mjs)
npm run preview    # Preview production build locally
```

Install with `npm install --legacy-peer-deps` (required due to peer dep conflicts).

There is no unit test suite. `tests/e2e-ahmed.mjs` is a standalone end-to-end script (login → create batch → upload XLSX → send availability → generate PO) run against a live dev server:
```bash
BASE_URL=http://localhost:4321 ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... node tests/e2e-ahmed.mjs
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

### Excel I/O

XLSX parsing (order uploads, product bulk-import) uses the `xlsx` package. Order-item matching maps barcodes from uploaded files against the `products` table. Barcode parsing handles both string and numeric Excel cell formats.

## Tooling

This repo is indexed by CodeGraph (`.codegraph/` at the repo root, 62 files / 656 nodes / 1,752 edges as of the last `codegraph init`). Use `codegraph explore "<symbol or question>"` (or the `codegraph_explore` MCP tool) before grep/find or reading files to locate code or trace call paths — it returns verbatim source plus caller graphs in one call. Re-run `codegraph init` after large structural changes to refresh the index.

## Environment Variables

```
PUBLIC_SUPABASE_URL=          # Supabase project URL
PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY=    # Supabase service role key (server-only, bypasses RLS)
PUBLIC_APP_URL=               # App URL without trailing slash (e.g. http://localhost:4321)
RESEND_API_KEY=               # Resend email API key
RESEND_FROM_EMAIL=            # Sender address (e.g. KSA CRM <onboarding@resend.dev>)
```

Copy `.env.example` to `.env` for local development.

**Resend sandbox restriction:** the default `RESEND_FROM_EMAIL` (`KSA CRM <onboarding@resend.dev>`) only delivers to the email address that owns the Resend account — any other recipient silently fails in production. To send to real users, verify a custom domain in the Resend dashboard (add the SPF/DKIM DNS records it provides), then set `RESEND_FROM_EMAIL` to an address on that domain. `sendEmail()` (`src/lib/email.ts`) returns `{ ok: false, error }` on failure rather than throwing — callers should surface `error` rather than assuming success.

## Deployment

Production runs on Render.com (`render.yaml`). Build command: `npm install --legacy-peer-deps && npm run build`. Start command: `npm start`. All secrets are set via the Render dashboard — never committed. Env var changes in the Render dashboard trigger an automatic restart; no redeploy needed.

**Host binding gotcha:** `@astrojs/node`'s standalone adapter reads `host` from Astro's top-level `server.host` config (`astro.config.mjs`), **not** from the options passed to `node({...})`. Setting `adapter: node({ host: true })` is silently overwritten by `astro:config:done` and does nothing. The correct fix — already applied — is `server: { host: true }` at the top level of `defineConfig`. Getting this wrong makes the app bind to a non-wildcard address, and Render's deploy port-scan times out with `"No open ports detected on 0.0.0.0"` even though the server logs show it's listening. Setting `HOST=0.0.0.0` as a Render env var only helps if this service was provisioned via a Render Blueprint sync (auto-applies `render.yaml`'s env vars); if it was created manually in the dashboard, that env var may not exist at all, so the code-level fix is the reliable one.

The GitHub Actions workflow `.github/workflows/supabase-keep-alive.yml` pings Supabase every 3 days to prevent free-tier auto-pause. It requires two repository secrets set in GitHub Settings → Secrets & Variables → Actions: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Without these the workflow fails silently and the project will still pause.

## Security Notes

- The service role key must never reach the browser. It is only imported in `src/lib/supabase-server.ts` and API route handlers.
- RLS policies enforce company isolation at the database level, but API routes also check user role before performing sensitive operations.
- `.env`, `CREDENTIALS.md`, `Test_Data/`, and `.xlsx` files are git-ignored. Historical secrets were previously committed — they should be considered rotated.
