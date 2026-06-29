> **SUPERSEDED (2026-06-10).** This audit describes the repository as it
> stood on 2026-05-11 (Azure workflows, `lib/db/`, no migrations). The
> codebase has since been rebuilt around Vercel + Supabase with eleven
> migrations and an in-app admin dashboard. Kept for history only —
> do not act on its recommendations. Current docs: `README.md`,
> `CLAUDE.md`, `docs/hardening-status.md`,
> `docs/runbooks/production-go-live.md`.

# PromoShop Inc. — Website Audit & Client Setup Report

**Repository:** `VicRobNes/v0-promoshop-inc-monday-apr-13`
**Branch audited:** `main`
**Date:** 2026-05-11
**Target hosting:** Vercel + Supabase + GitHub (client-owned accounts)

---

## 1. Summary

The site is a Next.js 16 (App Router, React 19) application. It is mid-migration from an Azure stack (Cosmos DB + Blob Storage + Entra/MSAL auth, deployed to Azure App Service) to a Supabase + Vercel stack. The public homepage, brands listing, quote-submission action, and the entire `/admin` UI run on Supabase. Several files, dependencies, scripts, infrastructure templates, and one API route still reference the old Azure code paths. These leftovers must be resolved before the project is handed to the client.

The findings below are limited to items that affect production correctness, security, deployment, or client onboarding. Stylistic / minor-refactor items are excluded.

---

## 2. Issues That Matter

### 2.1 Mixed stack — Azure code coexists with Supabase code

The repository contains two parallel implementations:

| Concern | Active path (used at runtime) | Legacy path (dead code) |
| --- | --- | --- |
| Auth (UI) | `lib/supabase/*`, `proxy.ts` | `lib/auth/*` (MSAL + signed-cookie session) |
| Data (public pages — home, brands index) | `lib/supabase/data.ts` | `lib/db/*` (Cosmos), `lib/brands.ts` seed |
| Data (admin pages) | Direct `supabase-js` calls | — |
| Storage (admin UI uploads) | `lib/storage/upload.ts` → Supabase Storage | `lib/storage/blob.ts` → Azure Blob SAS |
| Brand detail page (`/brands/[slug]`) | Sync seed array (`BRANDS`) | — |
| Studio page (`/studio`) | `lib/products.ts` → Cosmos fallback | — |

**Impact:** Two pages on the public site (`/brands/[slug]` and `/studio`) do **not** read from Supabase. Edits made in the admin panel will not appear on those pages until they are migrated to `lib/supabase/data.ts`.

**Files to remediate:**
- `app/brands/[slug]/page.tsx` — replace `BRANDS, getBrandBySlug` and `PRODUCTS` with Supabase queries.
- `app/studio/page.tsx` and `app/studio/StudioClient.tsx` — replace `lib/products.ts` calls with Supabase queries.
- After migration, delete `lib/db/`, `lib/auth/`, `lib/storage/blob.ts`, `lib/admin-overrides.ts`, `lib/brands.ts` (or thin it to a re-export), `lib/products.ts`, and `lib/image-registry.ts` if unused.

### 2.2 Admin API routes are broken on the new stack

`app/api/admin/image-overrides/route.ts` and `app/api/admin/upload/route.ts` were not updated during the Supabase migration:

- `image-overrides/route.ts` imports `getSessionFromRequest` and `hasRole` from `lib/auth/server.ts` (the old MSAL/cookie session). A Supabase-authenticated admin will receive **401 Unauthorized** when these endpoints are called.
- `upload/route.ts` mints **Azure Blob Storage SAS tokens**. Without `AZURE_STORAGE_*` env vars set on Vercel it returns **503**. Even with them set, uploads land in Azure, not Supabase Storage.
- The admin UI no longer calls these routes (uploads go directly from the browser to Supabase via `lib/storage/upload.ts`), so the routes appear to be dead. They should be deleted, or the entire `app/api/admin/` directory removed.

**Recommendation:** Delete `app/api/admin/upload/`, `app/api/admin/image-overrides/`, `lib/storage/blob.ts`, `lib/image-registry.ts`, and `scripts/migrate-images.ts`. Verify nothing in the admin UI still posts to those routes.

### 2.3 No Supabase schema in the repository

The application references the following Supabase tables and storage buckets, but the `CREATE TABLE` / RLS / bucket definitions are not checked in:

- Tables: `brands`, `products`, `hero_slides`, `quote_requests`, `admin_users`, `site_settings`
- Storage buckets: at minimum one per image group used in `lib/storage/upload.ts` (called via `uploadImage(file, bucket, …)`)

**Impact:** The client cannot reproducibly set up a new Supabase project, and there is no version history for schema changes.

**Recommendation:** Add a `supabase/migrations/` directory containing:
- Table definitions with primary keys, foreign keys, indexes (`slug` columns used in lookups should be `UNIQUE` and indexed).
- Row Level Security policies (see 2.4).
- Storage bucket creation and policies.
- A README documenting how to apply them (`supabase db push` via the Supabase CLI, or paste in SQL Editor).

### 2.4 Row Level Security posture is undefined

Admin pages perform `INSERT`, `UPDATE`, and `DELETE` against `brands`, `products`, `hero_slides`, `site_settings`, and `quote_requests` directly from the **browser**, using the public `anon` key. This only works safely if RLS is enabled and policies require an authenticated admin user (`auth.uid()` is in `admin_users` with `is_active = true`).

Without checked-in policies, the security posture cannot be verified. If RLS is off, or policies are permissive, **any visitor with the anon key (which is public) can read or write any table**.

**Recommendation:** Define RLS on every table:
- `SELECT`: public for `brands.is_active`, `products.is_active`, `hero_slides.is_active`, `site_settings`; admin-only for `admin_users`, full `quote_requests` read.
- `INSERT/UPDATE/DELETE`: admin-only (check `EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_active)`).
- `INSERT` on `quote_requests`: allow public (the marketing form needs this).

The `submitQuoteRequest` server action in `app/actions/quotes.ts` runs on the server but still uses the anon key (no service role). This is fine **only** with a public-insert RLS policy on `quote_requests`.

### 2.5 Outdated and conflicting documentation

- `README.md` describes Azure App Service + Cosmos + Blob + MSAL + Bicep + GitHub Actions OIDC. None of this is accurate for the production target (Vercel + Supabase).
- `docs/azure-architecture.md`, `docs/azure-integration-plan.md`, `azure.yaml`, `infra/` (Bicep), `scripts/seed-cosmos.ts`, `scripts/migrate-images.ts`, and four `.github/workflows/*.yml` Azure workflows remain in the tree.

**Recommendation:** Replace the README with a Vercel/Supabase version. Move all Azure docs and workflows into `docs/archived/` or delete them. The disabled GitHub Actions workflows (`azure-deploy.yml`, `azure-webapps-node.yml`, `main_promoshopinc.yml`, `azure-provision.yml`) are confusing and should be removed.

### 2.6 Unused dependencies inflate install time and attack surface

`package.json` lists Azure packages that are no longer used at runtime by any active code path (after fixing 2.1/2.2):

```
@azure/cosmos
@azure/identity
@azure/msal-browser
@azure/msal-react
@azure/storage-blob
jose
```

**Recommendation:** Remove these after the legacy paths in 2.1/2.2 are deleted. This shortens Vercel build times and removes dependencies the client must keep updated for CVEs.

### 2.7 No `.env.example`

There is no template listing the environment variables Vercel needs. The only required production variables are:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Recommendation:** Commit `.env.example` with these two variables (plus a comment explaining where to copy them from in the Supabase dashboard).

### 2.8 Next.js image optimization is disabled

`next.config.mjs` sets `images.unoptimized: true`. On Vercel this disables the built-in Image Optimization API, increasing bandwidth, slowing LCP, and giving up automatic WebP/AVIF conversion.

**Recommendation:** Remove `unoptimized: true`. Add `supabase.co` (or the project's specific subdomain) to `images.remotePatterns` so Supabase-hosted images load through the optimizer.

### 2.9 Hardcoded Supabase project URL in docs

`docs/ABIGAIL-GUIDE.md` links to `https://supabase.com/dashboard/project/hnqgnfkzuvhnphzmxalf`. This appears to be a developer-owned Supabase project. The client will need their own project; once set up, this link must be updated to the new project's URL.

### 2.10 Public site reads use `NEXT_PUBLIC_SUPABASE_ANON_KEY` server-side

`lib/supabase/server.ts` reads the anon key in server components. This is correct for public data, but note: any server-side admin operation (currently none, but future ones) must use a service role key — never the anon key — and that key must **never** be prefixed `NEXT_PUBLIC_`. Document this for the client's developer.

---

## 3. Recommended Supabase Configuration

### 3.1 Plan

**Plan: Pro ($25/month)** is the correct choice for a commercial production site. Reasons:

| Requirement | Free tier | Pro tier |
| --- | --- | --- |
| Database size | 500 MB | 8 GB (scales) |
| Storage | 1 GB | 100 GB |
| Egress | 5 GB | 250 GB |
| Daily backups | No | 7-day retention |
| Auto-pause after 7 days idle | Yes | No |
| Custom SMTP for auth emails | No | Yes |
| Preview branches (per-PR DBs) | No | Yes |
| Log retention | 1 day | 7 days |

The Free tier auto-pauses if the site sees no activity for a week and has no backup guarantee — both unacceptable for a client-facing production deployment. Pro removes those constraints.

### 3.2 Region

Choose the Supabase region that matches the Vercel deployment region.

- Vercel default deployment region is `iad1` (Washington, D.C., US East).
- Set Supabase region to **East US (North Virginia) — `us-east-1`**.

If the client's audience is primarily Canadian or European, override both Vercel and Supabase to a matching region (e.g., `ca-central-1` + Vercel region `cdg1`/`fra1` if EU). Server components on Vercel call Supabase synchronously, so cross-continent latency is felt on every page load.

### 3.3 Postgres version

Use the latest version offered at project creation (currently Postgres 15+). New projects default to the latest.

### 3.4 Connection style

The application uses `@supabase/supabase-js` and `@supabase/ssr`, which talk to PostgREST over HTTPS. No direct database connections, no pgbouncer/pooler URI required. **No additional configuration needed.**

### 3.5 Auth configuration (in Supabase dashboard)

- **Providers:** Email/Password — Enabled. Disable all social providers unless explicitly required.
- **Confirm email:** Enabled (default).
- **Disable new signups:** Set "Allow new users to sign up" to **off** under Authentication → Providers → Email. Admins are added manually via dashboard + `admin_users` row.
- **Site URL:** the production Vercel URL (e.g., `https://www.promoshopinc.com`).
- **Redirect URLs:** add the production URL plus Vercel preview pattern `https://*-promoshopinc.vercel.app/**`.
- **Custom SMTP:** Configure a sender domain (e.g., via Resend) so password-reset emails come from `noreply@promoshopinc.com` instead of `noreply@mail.app.supabase.io`. This is Pro-tier only.

### 3.6 Storage buckets

Create buckets matching the values passed to `uploadImage(file, bucket, …)` in `lib/storage/upload.ts`. Based on the existing admin pages, at minimum:

- `brands` (public read)
- `products` (public read)
- `hero` (public read)
- `team` (public read) — if team photos are added later

Set each bucket to **public** for read, and add an RLS policy on `storage.objects` restricting `INSERT/UPDATE/DELETE` to admin users only.

### 3.7 Branching (optional but recommended)

Pro tier includes preview branching. Connect it to the GitHub repository so every PR gets an isolated database. This pairs naturally with Vercel preview deployments.

---

## 4. Vercel Configuration

### 4.1 Plan

**Vercel Pro ($20/user/month).** The Hobby plan's Terms of Service prohibit commercial use. Pro also provides the bandwidth, build minutes, and team-seat model required for a business site.

### 4.2 Project import

1. Sign in to Vercel with the client's GitHub account.
2. Import `VicRobNes/v0-promoshop-inc-monday-apr-13` (or fork it into the client's GitHub organization first and import from there — recommended; see Section 5).
3. Framework preset auto-detects as Next.js. Build command, output, install command: leave defaults.

### 4.3 Environment variables

Set in **Settings → Environment Variables**, scoped to **Production, Preview, and Development**:

| Name | Value | Source |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API → anon public key |

No other variables are required after the cleanup in Section 2 is complete.

### 4.4 Domain

1. Purchase the domain at any registrar (Namecheap, Cloudflare Registrar, etc.). Cloudflare Registrar offers at-cost pricing and is recommended.
2. In Vercel → Project → Settings → Domains → Add.
3. Vercel will display required DNS records (an A record and/or a CNAME, plus optional `_vercel` TXT). Add them at the registrar.
4. Vercel auto-issues a Let's Encrypt certificate within minutes.
5. After the domain is live, update Supabase Auth **Site URL** and **Redirect URLs** to the new domain.

### 4.5 Analytics

`@vercel/analytics` is already included in the dependency list. Enable Web Analytics under the Vercel project's Analytics tab — no code change required.

---

## 5. GitHub Configuration

### 5.1 Repository ownership

The repository currently lives under a personal account (`VicRobNes`). For a client deliverable, move it to a client-owned GitHub organization:

1. Create a free GitHub organization for PromoShop Inc.
2. Transfer the repository: Settings → Danger Zone → Transfer ownership.
3. Re-link Vercel to the transferred repository (Vercel → Settings → Git → Connect Git Repository).
4. Re-link Supabase branching (if used) to the transferred repository.

### 5.2 Branch protection

On `main`:
- Require pull request before merging.
- Require status checks: the Vercel "Preview" check.
- Disallow force pushes.

### 5.3 Secrets

GitHub Actions are not required for this stack (Vercel deploys on push). All four `.github/workflows/azure-*.yml` files should be deleted (see 2.5).

---

## 6. Setup Order for the Client

Once the issues in Section 2 are resolved, the setup the client performs is:

1. **GitHub**
   1. Create the PromoShop Inc. organization.
   2. Accept the repository transfer from the developer.
2. **Supabase**
   1. Create account at `supabase.com`.
   2. New project → name `promoshop-production`, set a strong DB password (save in a password manager), region `us-east-1`, Pro plan.
   3. Apply schema: open SQL Editor, paste the contents of `supabase/migrations/*.sql` (provided by developer once 2.3 is resolved), Run.
   4. Storage → create buckets `brands`, `products`, `hero`, `team`, mark each Public.
   5. Authentication → Providers → Email: turn off public signups.
   6. Settings → API → copy `Project URL` and `anon public` key.
3. **Vercel**
   1. Create account, connect GitHub organization.
   2. Import the repository, Pro plan.
   3. Add the two environment variables from step 2.6 to Production + Preview + Development.
   4. Deploy.
4. **Custom domain**
   1. Purchase domain.
   2. Add to Vercel, copy DNS records to registrar.
   3. Once live, update Supabase Auth Site URL/Redirect URLs.
5. **First admin user**
   1. Supabase → Authentication → Users → Add user → set email, temporary password.
   2. Copy the new user's UUID.
   3. Table Editor → `admin_users` → Insert row: `id` = UUID, `email`, `full_name`, `role` = `admin`, `is_active` = `true`.
   4. Sign in at `https://<domain>/admin/login` and set a permanent password.

---

## 7. Optional Add-Ons

| Service | Purpose | Plan | Monthly cost |
| --- | --- | --- | --- |
| Resend | Email notifications for quote submissions; Supabase auth SMTP | Free up to 3,000 emails | $0–$20 |
| Cloudflare Registrar | Domain | At-cost | ~$10/year |
| Vercel Web Analytics | Traffic stats | Included in Pro | $0 |

---

## 8. Recurring Cost Summary

| Service | Plan | Monthly |
| --- | --- | --- |
| Vercel | Pro (1 seat) | $20 |
| Supabase | Pro | $25 |
| Domain | (annual) | ~$1 |
| GitHub | Free for org | $0 |
| Resend (optional) | Free tier | $0 |
| **Total** | | **~$46/month** |

---

## 9. Action Items Before Handoff

In priority order (developer to complete before transferring to the client):

1. Migrate `app/brands/[slug]/page.tsx` and `app/studio/page.tsx` to read from Supabase (2.1).
2. Delete `app/api/admin/upload/`, `app/api/admin/image-overrides/`, `lib/storage/blob.ts`, `lib/auth/`, `lib/db/`, `lib/admin-overrides.ts`, `lib/image-registry.ts`, `lib/brands.ts` legacy export, `lib/products.ts`, `scripts/seed-cosmos.ts`, `scripts/migrate-images.ts` (2.1, 2.2).
3. Commit `supabase/migrations/` with table DDL, indexes, RLS policies, and storage bucket policies (2.3, 2.4).
4. Remove Azure dependencies from `package.json` and run `pnpm install` to refresh the lockfile (2.6).
5. Delete `azure.yaml`, `infra/`, `docs/azure-*.md`, `.github/workflows/azure-*.yml`, `.github/workflows/main_promoshopinc.yml` (2.5).
6. Rewrite `README.md` for the Vercel + Supabase stack (2.5).
7. Add `.env.example` (2.7).
8. Remove `images.unoptimized: true` from `next.config.mjs` and add Supabase host to `remotePatterns` (2.8).
9. Update `docs/ABIGAIL-GUIDE.md` "Key Links" section to point at the client's new Supabase project once provisioned (2.9).
