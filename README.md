# PromoShop Inc. — Corporate site

Next.js 16 / React 19 marketing site for PromoShop Inc., hosted on Vercel
with a Supabase Postgres database for hero slides, brand listings, and
quote-request submissions.

---

## Stack

| Layer | Service |
| --- | --- |
| Framework | Next.js 16 (App Router) on Node 20+ |
| UI | React 19, Tailwind CSS v4, Radix UI primitives |
| Hosting | Vercel |
| Database | Supabase Postgres (via `@supabase/ssr` + `@supabase/supabase-js`) |
| Analytics | Vercel Web Analytics |

There is no separate admin UI in the application. Brands, hero slides,
and quote requests are managed directly through the Supabase Dashboard
(Table Editor).

---

## Local development

```bash
pnpm install
pnpm dev
```

The dev server runs on http://localhost:3000. Pages that read from
Supabase will return empty lists if the environment variables are not
configured, and the site falls back to the seed content compiled into
the build (see `lib/seed-data/`).

### Environment variables

Copy `.env.example` to `.env.local` and fill in the two values from your
Supabase project (Dashboard → Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

The `NEXT_PUBLIC_` prefix is required so the values are exposed to the
browser. No other environment variables are needed.

### Useful scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server on :3000 |
| `pnpm build` | Production build (includes type-check) |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |

---

## Supabase setup

The complete schema lives in `supabase/migrations/0001_init.sql`. To
provision a fresh Supabase project:

1. Create a new project at https://supabase.com.
2. Open SQL Editor → New query.
3. Paste the contents of `supabase/migrations/0001_init.sql`.
4. Click **Run**.

The schema creates three tables, all with Row-Level Security enabled:

| Table | Public read | Public write |
| --- | --- | --- |
| `brands` | rows where `is_active = true` | none |
| `hero_slides` | rows where `is_active = true` | none |
| `quote_requests` | none | INSERT only (new submissions) |

To populate the site after running the migration:

- **Brands**: Supabase Dashboard → Table Editor → `brands` → Insert row.
  Set `is_active = true` and assign each brand a unique `slug`.
- **Hero slides**: same flow against the `hero_slides` table.
- **Quote requests**: created automatically when visitors submit the
  `/my-quote` form. View them in Supabase Dashboard → Table Editor →
  `quote_requests`.

---

## Deployment

The site deploys automatically on every push to `main` via the
Vercel-GitHub integration. Preview deployments are created for every
pull request.

In Vercel → Project → Settings → Environment Variables, set the two
variables above for the Production, Preview, and Development scopes.

---

## Project layout

```
app/                # Next.js App Router pages
  page.tsx          # Homepage (hero slideshow + brand scroll)
  brands/           # Brand listing + per-brand pages
  studio/           # Product catalog
  my-quote/         # Quote request flow
  about/            # About page
  sign-in/ sign-up/ # Customer auth gate (localStorage-backed)
  actions/          # Server actions (quote submission)
components/         # UI components
hooks/              # Custom React hooks
lib/
  supabase/         # Supabase clients + typed queries
  auth/             # Customer-auth provider (client-only)
  cms/              # Static CMS content for marketing copy
  seed-data/        # Compiled-in brand & product catalog
public/             # Static assets
supabase/
  migrations/       # Versioned schema SQL
```
