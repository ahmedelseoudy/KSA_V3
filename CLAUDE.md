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

`src/lib/db/` contains per-table query modules (companies, products, orders, availability, purchase-orders). All server-side DB access uses the service-role Supabase client from `src/lib/supabase-server.ts`, which bypasses RLS. Browser-side code uses the anon client from `src/lib/supabase.ts`, subject to RLS.

### Auth & Roles

Roles: `super_admin` → `admin` → `company`. Auth state is managed via Supabase Auth tokens stored in httpOnly cookies. The `users_profile` table links auth users to roles and (for company users) to their `companies` row via `companies.user_id`.

`users_profile` columns: `id` (UUID, FK to auth.users), `email`, `role`, `status` (`pending`/`approved`/`suspended`), `invited_by`, `approved_by`, `created_at`, `approved_at`. There is no `full_name` column.

To create a new admin: create the user in Supabase Dashboard → Authentication → Users, then run in SQL Editor:
```sql
UPDATE public.users_profile
SET role = 'super_admin', status = 'approved', approved_at = NOW(), approved_by = id
WHERE email = 'admin@example.com';
```

Company invitation flow: Admin creates company → sends invite email (Resend via `src/lib/email.ts`) → company clicks setup link → `POST /api/auth/setup-password` creates Supabase auth user and links it to the company.

### Database

Supabase-hosted Postgres. Migrations live in `supabase/migrations/`. Key helper RPCs defined in `001_crm_schema.sql`:
- `get_all_products_for_matching()` — paginated product lookup for XLSX order-item matching (SECURITY DEFINER to work across companies)
- `create_company_user()` — creates Supabase auth user for a company
- `keep_alive_ping()` — called by GitHub Actions cron every 3 days to prevent free-tier auto-pause

### Excel I/O

XLSX parsing (order uploads, product bulk-import) uses the `xlsx` package. Order-item matching maps barcodes from uploaded files against the `products` table. Barcode parsing handles both string and numeric Excel cell formats.

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

## Deployment

Production runs on Render.com (`render.yaml`). Build command: `npm install --legacy-peer-deps && npm run build`. Start command: `npm start`. All secrets are set via the Render dashboard — never committed.

The GitHub Actions workflow `.github/workflows/supabase-keep-alive.yml` pings Supabase every 3 days to prevent free-tier auto-pause. It requires two repository secrets set in GitHub Settings → Secrets & Variables → Actions: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Without these the workflow fails silently and the project will still pause.

## Security Notes

- The service role key must never reach the browser. It is only imported in `src/lib/supabase-server.ts` and API route handlers.
- RLS policies enforce company isolation at the database level, but API routes also check user role before performing sensitive operations.
- `.env`, `CREDENTIALS.md`, `Test_Data/`, and `.xlsx` files are git-ignored. Historical secrets were previously committed — they should be considered rotated.
