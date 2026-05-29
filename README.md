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
