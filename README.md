# PromoShop Inc. — Corporate site

Next.js 16 / React 19 marketing site for PromoShop Inc., hosted on Vercel
with a Supabase Postgres database (and Supabase Storage for image files).
Every public image on the site, plus the brand and product catalogs and
homepage hero slideshow, are managed from the Supabase Dashboard. Changes
made in the Table Editor are reflected on the live site on the next
request — there is no admin UI in the application itself.

---

## Stack

| Layer | Service |
| --- | --- |
| Framework | Next.js 16 (App Router) on Node 20+ |
| UI | React 19, Tailwind CSS v4, Radix UI primitives |
| Hosting | Vercel |
| Database | Supabase Postgres (`@supabase/ssr` + `@supabase/supabase-js`) |
| Image hosting | Supabase Storage (bucket `site-images`) |
| Analytics | Vercel Web Analytics |

The root layout renders with `dynamic = 'force-dynamic'` so every page
fetches fresh data on every request. Image URLs are cache-busted with
`?v=<updated_at>` so replacing a row's URL invalidates browser, CDN, and
`next/image` caches automatically.

---

## Local development

```bash
pnpm install
pnpm dev
```

The dev server runs on http://localhost:3000.

### Environment variables

Copy `.env.example` to `.env.local` and fill in three values from the
Supabase project (Dashboard → Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by
  every public page. The `NEXT_PUBLIC_` prefix is mandatory; without it,
  the values aren't exposed to the browser and the site fails to load.
- `SUPABASE_SERVICE_ROLE_KEY` — used **server-side only** by the hidden
  `/admin-dashboard` page to upload files and update rows. Bypasses Row
  Level Security. Never use the `NEXT_PUBLIC_` prefix on this one.

Three further **optional** variables (`RESEND_API_KEY`,
`QUOTE_NOTIFICATION_EMAIL`, `QUOTE_NOTIFICATION_FROM`, all server-side only)
enable an email notification for every quote-request submission. With them
unset, submissions are still saved to the `quote_requests` table — no email
is sent. Setup walkthrough: `docs/RESEND-EMAIL-SETUP.md`.

### Useful scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server on :3000 |
| `pnpm build` | Production build (includes type-check) |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm tsx scripts/generate-seed-sql.ts` | Regenerate `supabase/migrations/0003_seed_data.sql` from the in-repo seed files (run after editing `lib/seed-data/*` or `lib/cms/team.ts`) |

---

## Supabase setup

Three migrations live in `supabase/migrations/`. Run them in order from
the Supabase Dashboard → SQL Editor → New query:

1. `0001_init.sql` — base tables: `brands`, `hero_slides`, `quote_requests`
   with Row-Level Security.
2. `0002_images_and_products.sql` — adds the image registry
   (`site_images`), the product catalog (`products`, `product_colours`,
   `product_images`), and creates the public `site-images` Storage
   bucket.
3. `0003_seed_data.sql` — populates every table with current default
   content so the site renders the same imagery and product catalog
   it always has. Idempotent (`ON CONFLICT DO UPDATE`), safe to re-run.

After running all three, the dashboard's Table Editor shows:

| Table | Rows | What it controls |
| --- | --- | --- |
| `brands` | 20 brands | Brand listing page and detail pages |
| `hero_slides` | 4 homepage slides | The slideshow on the homepage |
| `products` | full catalog | Studio page and brand-specific listings |
| `product_colours` | colour variants per product | Colour pickers |
| `product_images` | all product gallery imagery | Product cards, modal, lightbox |
| `site_images` | every other image | Site logo, About hero, brand logos, brand lifestyle backdrops, team photos |
| `quote_requests` | filled from the public form | Incoming quote requests |

---

## Image management

Two ways to replace any image on the site:

### Option 1 — `/admin-dashboard` (recommended for non-developers)

Open `https://<your-domain>/admin-dashboard` in a browser. The page is
unlinked (no nav link, noindex metadata), so visitors don't find it.

For each image on the site you see:

- A thumbnail of the current image
- A label that tells you what it is
  (e.g., "Brand logo: Patagonia", "VSSL Rift Tumbler 16 oz — Sahara — Image 1")
- A file picker and a **Replace** button

Click **Choose File**, pick the new image, click **Replace**. The page
uploads the file to Supabase Storage and updates the database row
that points at it. The change is live on the next page request.

The dashboard groups images by type:

- **Site images** — singletons: site logo, About-page hero, team
  photos, brand lifestyle backdrops
- **Brand logos** — one per brand
- **Hero slides** — the homepage slideshow
- **Product images** — every product gallery image, collapsible by SKU

Requires `SUPABASE_SERVICE_ROLE_KEY` to be set on Vercel.

The dashboard intentionally has no access control. Treat the URL as the
secret. If it leaks, anyone who hits it can replace any image on the
site (but nothing else — they cannot read quote requests, modify
non-image columns, or alter the schema, since the service role key
never leaves the Vercel server).

### Option 2 — Supabase Dashboard directly

If you'd rather work in the Supabase Table Editor, every public-facing
image lives in Supabase and is keyed by a human-readable label:

### Where to edit each image

| Image | Table | Column or row |
| --- | --- | --- |
| Site logo (header / footer) | `site_images` | row `site.logo` |
| About-page hero | `site_images` | row `about.hero` |
| Team member photo | `site_images` | row `team.<slug>` (label: "Team photo: …") |
| Brand logo on the homepage scroll | `brands` | `logo_url` column |
| Brand lifestyle backdrop (brand detail page) | `site_images` | row `brand.<slug>.lifestyle` |
| Homepage hero slide | `hero_slides` | `image_url` column |
| Product gallery image | `product_images` | `url` column on the relevant row (label includes product name, colour, and image number) |

### How to replace an image

1. **Upload the new file** to Supabase Storage → bucket `site-images`.
   Use a descriptive filename so future maintainers can find it.
   The upload page in the Dashboard shows the public URL once the file
   is in.
2. **Open the row** in Table Editor that points at the image you want
   to replace (use the table above to find the right one). The `label`
   column tells you what each row is for.
3. **Paste the new public URL** into the `url` / `logo_url` /
   `image_url` column (whichever applies to that table) and save.

The next page request on the live site shows the new image. No code
change, no redeploy. The `updated_at` timestamp the row writes on save
becomes a cache-busting query string on the URL the browser fetches,
so even repeat visitors see the change without clearing their cache.

### Adding a new image slot

Open `site_images` in Table Editor and **Insert row**:

- `key` — stable identifier you'll reference from code (lowercase,
  dotted, no spaces, e.g., `homepage.testimonial.acme`).
- `label` — what a human reads to find this image again
  (e.g., "Homepage testimonial logo: Acme Corp.").
- `url` — the public Storage URL.
- `alt_text` — short accessibility description.

Then reference it from code via `<SiteImage imageId="homepage.testimonial.acme" defaultSrc="…">`.

---

## Deployment

The site deploys automatically on every push to `main` via the
Vercel-GitHub integration. Pull requests get preview deployments.

In Vercel → Project → Settings → Environment Variables, set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the
**Production**, **Preview**, and **Development** scopes.

---

## Project layout

```
app/                     # Next.js App Router pages
  page.tsx               # Homepage (hero slideshow + brand scroll + CTA)
  brands/                # Brand listing + per-brand pages
  studio/                # Product catalog
  my-quote/              # Quote-request flow
  about/                 # About page
  sign-in/ sign-up/      # Customer auth gate (localStorage-backed)
  actions/               # Server actions (quote submission)
components/              # UI components
  site-images-provider.tsx  # Root-layout context for site_images map
  site-image.tsx            # <Image> wrapper that resolves through the provider
hooks/                   # Custom React hooks
lib/
  supabase/              # Typed Supabase clients + queries
    client.ts            #   browser client
    server.ts            #   server-component client
    data.ts              #   getHeroSlides, getSupabaseBrands
    products.ts          #   getAllProducts (products + colours + images)
    images.ts            #   getSiteImagesMap (the site_images registry)
  auth/                  # Customer-auth provider (localStorage-backed)
  cms/                   # Static marketing copy (titles, body, etc.)
  seed-data/             # Compiled-in fallback catalog (used by the seed generator)
public/                  # Static assets (favicons, font fallbacks)
scripts/
  generate-seed-sql.ts   # Regenerates supabase/migrations/0003_seed_data.sql
supabase/
  migrations/            # 0001_init, 0002_images_and_products, 0003_seed_data
```
