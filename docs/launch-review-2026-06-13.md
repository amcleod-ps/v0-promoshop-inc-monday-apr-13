# PromoShop Inc. — Launch Review, Hardening & Merge Plan (2026-06-13)

**Goal:** a clean, bulletproof launch on or before **June 21**.
**Branch reviewed/fixed:** `claude/nifty-knuth-b7gtdr` (39 commits ahead of
`main`, 0 behind — a fast-forward merge).
**Method:** four parallel deep-review agents (security/backend, data/CMS,
frontend/UX/a11y, config/SEO/infra), each cross-checking the prior
2026-06-10 reviews so we verify *resolution* rather than re-report; findings
re-verified against `file:line`; build + lint + a no-Supabase runtime smoke
test of every route. This pass sits on top of the post-2026-06-10 work
(`pnpm lint` restored, admin production pass #38, full-site UI/UX hardening
#41) that the older tracking doc predated.

---

## 1. Launch-readiness call

**Code is launch-ready** once the decision points in §5 are actioned (most are
config/content, not code). The build/type-check/lint gates are green, every
route renders without 500s even on the Supabase-outage fallback path, security
headers + RLS + upload validation + theme-injection sanitization all hold, and
this pass closed the remaining code-level gaps the review found. **No blocking
code defects remain.** The launch now turns on operator/client actions (admin
gate, domain, content) and your **merge approval**.

## 2. Verification (what was checked, and the result)

| Gate / check | Method | Result |
| --- | --- | --- |
| Dependencies | `pnpm install` | ✅ clean |
| Type-check + build | `pnpm build` (Next/tsc) | ✅ clean |
| Lint | `pnpm lint` (ESLint 9 flat) | ✅ 0 findings |
| Seed ↔ migration sync | regenerated `0003_seed_data.sql`, diffed | ✅ byte-identical |
| Route runtime (no Supabase) | served prod build, curled every route | ✅ public 200, unknown brand + unknown URL → branded 404, **0 error markers** |
| Security headers | live header inspection | ✅ CSP, `X-Frame-Options: DENY`, nosniff, Referrer-Policy |
| Admin noindex | live header inspection | ✅ `x-robots-tag: noindex, nofollow` |
| robots.txt / sitemap.xml | live fetch | ✅ admin path not leaked; sitemap = public + brand routes only |
| OG/Twitter image | live fetch | ✅ valid 1200×630 PNG at `/opengraph-image` + `/twitter-image` |

**Success criteria for go-live:** all of the above green (they are) **plus** the
live-domain smoke test in `docs/runbooks/production-go-live.md` §6 (real
quote submission lands a `quote_requests` row + notification email; admin gate
challenges; 404 is branded; phone pass).

## 3. Fixes applied this pass (all on the review branch)

**Backend / security**
- `lib/email/quote-notification.ts` — normalize **all** interpolated fields
  (esp. `email`, which becomes the `reply_to` header) so an embedded newline
  can't reach Resend. Defense-in-depth on top of Zod.
- `app/admin-dashboard/create-actions.ts` `createProductImage` — verify the
  `colour_id` belongs to the supplied `productSku` **before** uploading
  (prevents cross-product image rows and orphaned storage objects).
- `createSiteImage` + `actions.ts updateSiteContent` — cap the `label` field
  (previously uncapped admin-supplied text).

**Data / CMS**
- `lib/supabase/theme.ts` — theme override `OPACITIES` now includes `/35`
  (used by the contact form's six focus rings) and drops six provably-unused
  values. Before this, a brand-colour change left those focus rings the old
  red; now a rebrand is consistent and the inlined override CSS is smaller.

**Frontend / UX / a11y**
- `components/header.tsx` — mobile menu closes on route change (incl.
  back/forward) and on **Escape**.
- `components/contact-section.tsx` — success-message timer cleaned up on
  unmount and de-stacked across repeat submits.
- `components/footer.tsx` — Quick Links use explicit `{label, href}` instead
  of deriving hrefs from display text (latent 404 risk removed).
- `components/team-section.tsx` — grid keyed by stable `slug`, not display name.
- `components/brand-logo-scroll.tsx` — the duplicated marquee run is now
  non-interactive (no focusable links inside the `aria-hidden` subtree).
- `app/studio/StudioClient.tsx` + `app/my-quote/my-quote-client.tsx` —
  visible focus rings on the filter buttons and quote-builder tabs.
- `app/global-error.tsx` — adds a "Back to Home" hard-navigation escape
  (when the root layout itself throws, `reset()` alone can loop).

**SEO**
- `app/opengraph-image.tsx` + `app/twitter-image.tsx` (new) and
  `app/layout.tsx` (`twitter.card: summary_large_image`) — shared links now
  render a branded preview card instead of a blank one. The image is a
  sensible default; a client-designed asset can replace it.

**Docs reconciliation**
- `docs/hardening-status.md` — corrected the stale "`pnpm lint` is broken"
  claim, marked the ESLint item done, recorded this pass.
- `README.md` — "Seven migrations" → **eight** (added the `0008` step that was
  missing from the setup list).

## 4. Reviewed and confirmed solid (no change needed)

Service-role key isolation (`server-only`, never in client bundle); **every**
mutating admin action re-checks `requireAdminAction()`; timing-safe admin
password compare; magic-byte upload validation (SVG/spoofed-MIME blocked);
theme `<style>` injection hex-sanitized (Table-Editor bypass covered);
CTA-URL validation blocks `javascript:`/`//host`; RLS insert-only + status-pinned
on `quote_requests`, no anon PII read; DB CHECK + server-timestamp backstops;
all `lib/supabase/*` getters swallow errors (an outage can't 500 the layout);
cache-bust join correct everywhere; `withMinImageWidth` never downgrades hints;
seed↔SQL in sync; open-redirect guard correct; env-var cross-check clean; no
committed secrets; Azure cruft fully removed.

## 5. Decision points & actions you own (prioritized)

> Code can't resolve these — they need a config value, a content asset, or
> your sign-off. Ordered by launch impact.

**P0 — gate the launch**

1. **Merge approval.** The fixes sit on `claude/nifty-knuth-b7gtdr`; a **draft
   PR → `main`** is open. The merge-approval policy was unspecified, so the
   merge is **held for you**.
   - *Option A (recommended):* you approve, I mark ready + squash-merge.
   - *Option B:* you self-merge after reviewing the PR.
   - *Option C:* require a second human reviewer first.
   - *Why held:* merging is outward-facing/hard-to-reverse; one round of
     approval doesn't carry across to "push to production."

2. **Set `ADMIN_DASHBOARD_PASSWORD` in Vercel (Production + Preview).**
   - *Issue:* the admin CMS is **default-open** (URL-as-secret) and wields the
     service-role key; until the var is set, every CMS mutation is invocable by
     anyone who finds the URL or a Next-Action id. This is the single highest
     security item.
   - *Option A (recommended):* set a strong password now — ~0 effort, flips the
     already-merged Basic-auth gate on (see `docs/ADMIN-LOGIN-SETUP.md`).
   - *Option B:* consciously accept URL-as-secret (a documented prior client
     decision from 2026-06-01). Pro: zero friction. Con: full unauthenticated
     write access if the URL leaks.

**P1 — required for a correct public launch**

3. **Confirm the production domain** (`promoshopinc.com` vs `promoshopstudio.com`)
   and set `NEXT_PUBLIC_SITE_URL`. Drives canonical URLs, sitemap, robots, and
   the OG image URL; unset → these point at `localhost`.
4. **Rotate the Supabase anon + service-role keys** before go-live (they've
   passed through many hands), then update Vercel and redeploy. Git history is
   confirmed clean.
5. **Consolidate the Vercel project/team** (deploys have run under 3 teams) so
   all env vars live on the one production project.

**P2 — content the client must supply (cannot be coded around)**

6. **Rehost the dead product images** — JAK 005/006 and TOP 010–015 use
   `drivingi.com` URLs that 404. Supply real photos → update seeds → rerun
   `pnpm tsx scripts/generate-seed-sql.ts`.
7. **Replace placeholder imagery** — 4 hero slides (currently brand logos),
   the About hero (Rhone logo), 4 team photos (stock). Editable via
   `/admin-dashboard`.
8. **Confirm About-page copy** — the static fallback says "Promoshop **Canada
   Ltd.**" with a "**Los Angeles**" office, contradicting "PromoShop Inc." and
   the Windsor/Toronto/Detroit contacts. Confirm wording; seed the
   `site_content` About rows.
9. **Legal pages & social links** — Privacy/Terms/Shipping links and social
   icons were removed for launch (they were dead `#` placeholders). Supply
   policy copy / real profile URLs to restore them.
10. **(Optional) Resend email** — set `RESEND_API_KEY`,
    `QUOTE_NOTIFICATION_EMAIL`, `QUOTE_NOTIFICATION_FROM` to email new leads
    (`docs/RESEND-EMAIL-SETUP.md`). Leads still persist to the DB without it.
11. **(Optional) Designed OG image** — a branded default now ships; replace
    with a client design by dropping a static `app/opengraph-image.png`.

**P3 — accepted risks / optional follow-ups (none block launch)**

12. **Quote-form spam** — honeypot + per-IP in-memory rate limit blunt scripted
    spam but aren't a captcha; the direct-PostgREST insert path is unbounded by
    *row count* (length-capped). *Decision:* add Turnstile/hCaptcha, or
    accept-and-monitor `quote_requests` counts.
13. **Engineering follow-ups (deliberately not done pre-launch — low value or
    refactor risk):** genericize admin server-action error strings (currently
    surface raw Postgres text to the gated admin); move the rate-limit key to a
    platform-trusted IP / shared store (Vercel sets `x-forwarded-for`, so it's
    fine today); mark dialog backgrounds `inert` for screen-reader browse mode;
    nonce-based CSP to drop `'unsafe-inline'`; make `withCacheBust` idempotent;
    remove the dead duplicate `use-toast`. Track post-launch.

## 6. Timeline to June 21

- **Now → merge:** approve the draft PR (P0 #1). Fast-forward, no conflicts.
- **At deploy:** set env vars (P0 #2, P1 #3), rotate keys (P1 #4), consolidate
  project (P1 #5); redeploy.
- **Before public:** client content (P2 #6–#9); run the live-domain smoke test
  (runbook §6).
- **Launch.** Then the §5 P3 follow-ups as a post-launch hygiene pass.

## 7. Risk flags

- **Highest residual risk:** admin gate left open (P0 #2). Mitigated by setting
  the password.
- **Silent-failure risk:** if `NEXT_PUBLIC_SUPABASE_*` are missing at deploy,
  the public site silently shows static fallbacks **and quote submissions
  fail** while the rest looks healthy — the live smoke test (real submission)
  is the catch. The quote action already logs loudly server-side.
- **Crawler risk:** if `NEXT_PUBLIC_SITE_URL` is unset, canonical/sitemap/OG
  URLs point at `localhost` — set it before submitting the sitemap.
