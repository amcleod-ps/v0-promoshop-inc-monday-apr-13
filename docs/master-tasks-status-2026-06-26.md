# Master tasks — live-code status audit (2026-06-26)

> Confirms the current state of every item in `PromoShopStudioMasterDevTasks.md`
> against the actual code on branch `claude/new-session-9ur47b`. The master list
> was built from the **June 10** review; substantial work landed after it (admin
> pass Jun 14, security review Jun 15, post-launch hygiene). This audit reads the
> live files, not the dated review. Method: one auditor per cluster + an
> adversarial cross-check pass on every non-OPEN verdict.

## Bottom line

The whole launch-critical Part C backlog (funnel, privacy, security, crash
safety, SEO, most performance, data/seed) is **closed in code**. What actually
remains splits into four buckets:

1. **One HIGH item that isn't even on the list** — the `next` dependency bump.
2. **Owner decisions** (not pure code): M23, H10.
3. **Client content** (Abigail): B6 pages, B8 copy, B2/B7 imagery.
4. **Net-new feature builds** — the client priorities, chiefly **Priority 3**
   (region-aware products + managed filter tags) and **Priority 4**
   (Collections + Mailchimp export). Priority 2 and Priority 5's accessibility
   are largely **done already**.

---

## 0. Not on the master list, but the highest-severity open item

- **`next` is pinned at `16.2.0`** (`package.json:` `"next": "16.2.0"`,
  confirmed in `pnpm-lock.yaml`). The June-15 security review flagged this as
  🔴 HIGH — 16.2.0 matches **14 OSV advisories**, including a middleware/proxy
  bypass that touches the admin gate, plus SSRF/DoS. The code hardening from
  that review landed; **the bump never did**. Fix: `pnpm up next@16.2.9 &&
  pnpm build && pnpm lint` (16.2.9 is clean; `eslint-config-next` is already at
  `^16.2.9`). Low-risk, high-value — recommend doing this first.
- **Admin gate is shipped but dormant** — set `ADMIN_DASHBOARD_PASSWORD` in
  Vercel to turn it on. Pure config (Abigail/Victor), no code change.

---

## 1. Already fixed (Part C launch backlog) — verified in code

| Item | What it was | Status | Key evidence |
| --- | --- | --- | --- |
| B4 | Quote step dropped new-visitor choices → empty quote | ✅ FIXED | Cart persists in `lib/quote-context.tsx` independent of sign-up; `sign-up/page.tsx:54-60` only merges contact fields |
| H1 | Sign-up autofill wiped saved quote | ✅ FIXED | `setContactInfo` is a field-level merge (`quote-context.tsx:233-235`) |
| H6 | Honeypot silently dropped real leads | ✅ FIXED | Renamed `website`→`hp_check`, off-screen, uncapped; only non-empty discards (`quotes.ts:31,47-50`) |
| M3 | Manual add-product used static list | ✅ FIXED | `/my-quote` server page uses live `getAllProducts()` filtered `is_active` |
| M6 | Cart: no dedup/limits, bad image crashed page | ✅ FIXED | `addItem` merges dupes, `clampQuantity`, `safeImagePath`, `SafeImage` fallback |
| M25 | Cart+notes exceeded cap, blamed visitor | ✅ FIXED | Notes maxLength 4000; client pre-check 16k = Zod 16k < DB 20k CHECK *(stale "10,000" comment is cosmetic)* |
| M22 | Broken deploy looked healthy, leads silently failed | ✅ FIXED | `quotes.ts:68-77` logs loudly + returns error; go-live runbook has a real submission smoke test |
| L6 | Email dropped on newlines; rate limiter self-reset | ✅ FIXED | `singleLine()` normalizes interpolated fields; limiter evicts ~10% oldest, not `clear()` |
| H2 | Theme CSS injection via Table-Editor | ✅ FIXED | `SAFE_HEX` + `safeThemeValue()` gate every injected value (`lib/supabase/theme.ts`) |
| H3 | No error/404 screens; unguarded storage | ✅ FIXED | `error.tsx`/`global-error.tsx`/`not-found.tsx` exist; all 3 localStorage files try/catch-guarded |
| H4 | One title/desc, no sitemap, no h1, utility pages indexable | ✅ FIXED | Per-page metadata, `sitemap.ts`, real `<h1>`, noindex on utility/admin pages |
| H7 | Heavy homepage / CLS | ✅ FIXED | Only first hero slide `fetchPriority=high`, rest lazy; fixed-aspect frames; sized logos |
| M5 | Logo strip jumped on loop | ✅ FIXED | Doubled `w-max` track + `translateX(-50%)`, reduced-motion aware |
| M10 | Same data fetched twice/page | ✅ FIXED | Every getter wrapped in React `cache()` |
| H11 | Reseed reverted admin edits | ✅ FIXED | `0003` is `ON CONFLICT DO NOTHING`/label-only; generator emits the same |
| M26 | Team photo broke on rename | ✅ FIXED | Lookup keyed by stable `slug`; `directImageUrl` shadows seeded default |
| B1 | ~40 product images 404 | ✅ FIXED (guard) | `SafeImage` → `/placeholder.svg` on error everywhere product imagery renders |
| B3 | Brand fonts loaded but never applied | ✅ FIXED | next/font variables wired through `@theme`; applied on body/about |
| H8 | Lint command broken | ✅ FIXED | `eslint@9` + flat config present; `pnpm lint` exits 0 |
| H12 | Go-live doc described Azure | ✅ FIXED | `docs/runbooks/production-go-live.md` is Vercel+Supabase; Azure runbook archived |
| M8 | Stray theme provider overriding real theme | ✅ FIXED | `theme-vars-provider.tsx`/`theme-provider.tsx` deleted |
| L10 | ~1.4 MB unused public files / orphan collection imgs | ✅ FIXED | public/ is 1.2 MB all-referenced; collection/category JPGs removed in `ac8ca82` |
| L3 | Duplicated slugify / seed escaping gap | ✅ FIXED | Generator imports shared `slugify`; `sqlTextArray` escapes properly |
| L5 | Dead timers/exit-anim/setState-in-updater | ✅ FIXED | Lightbox, modal, contact timer, slideshow autoplay all corrected |

Plus the **Priority 2 grounded leads** and **Priority 5 accessibility** items — see below.

---

## 2. Still open — OWNER decisions (Victor)

- **M23 — direct PostgREST insert (PARTIAL).** Length CHECKs (`0007`) and forced
  server timestamps (`0008` trigger) are in. **Still open:** the `anon` insert
  policy has no DB-side rate limit/captcha, and the `id` column is caller-
  supplied (faketable PK collisions). To fully close: a `BEFORE INSERT` trigger
  forcing `id := gen_random_uuid()`, and either a captcha (Turnstile/hCaptcha)
  + DB throttle or moving inserts behind an authenticated RPC. *Decision: close
  it, or accept the residual risk for launch.*
- **H10 — faux sign-in/sign-up (AMBIGUOUS).** Dead UI (forgot-password, social,
  remember-me) is already gone. **Still open:** both pages accept any login,
  collect a password and discard it, and say "sign in to your account" with no
  "saved on this device / demo" disclosure. *Decision: (a) honest copy +
  rename CTAs and stop collecting the password, or (b) build real Supabase
  Auth.*
- **Performance scale (M11 PARTIAL, L8 PARTIAL).** `/studio` and `/my-quote`
  serialize the **whole** active catalog into the RSC payload and filter
  client-side; search is un-debounced and `ProductCard` isn't memoized. Fine at
  ~16 products; revisit (server-side filter/pagination, `React.memo`, debounce)
  before the catalog grows. *Decision: defer or do now.*

---

## 3. Still open — CLIENT CONTENT (Abigail)

- **B6 — legal pages.** Dead Privacy/Terms/Shipping links and the sign-up
  consent line were correctly **removed** (the prescribed interim fix). Real
  `/privacy`, `/terms`, `/shipping` pages still need client copy before the
  links + consent line can return (PIPEDA).
- **B8 — About copy (PARTIAL).** The broken sentence is fixed, but the wrong
  entity **"Promoshop Canada Ltd."** and city **"Los Angeles, California"** still
  live in both `lib/cms/about.ts:22` and seed `0004`. Needs confirmed legal
  name + office city, then update both.
- **B2 — hero/About imagery (AMBIGUOUS).** Still brand wordmark logos used as
  photos (`mainmemory/1-4.png`, `11.png`). Swap for real photography (overlaps
  the Priority 1 file). Content + asset decision, no code change.
- **B7 — team photos.** All placeholders pending real headshots (content).

---

## 4. Still open — NET-NEW FEATURE BUILDS (the client priorities)

- **Priority 2 — DONE** (as of the `claude/new-session-9ur47b` work). Product
  **edit** UI exists (name/category/description/sizes/genders/min-qty/order +
  per-colour editor), M2 "no sizes" fixed, L4 empty-fallback documented &
  surfaced, **Save-button overlap fixed** (`products-tab.tsx:971-975`). Newly
  built: (a) **image size control** — `lib/image-size.ts` adds a per-slot
  Smaller/Default/Larger control (logo today), mirroring image-fit; (b)
  **text formatting** — `lib/rich-text.tsx` renders a safe `**bold**` /
  `*italic*` / `[link](url)` subset, adopted on the About body + footer
  tagline/ADA notice. **Open decision for Victor:** confirm the formatting
  control set (block controls like headings/lists deliberately withheld to
  protect the a11y heading order).
- **Priority 3 — partly scaffolded, mostly new.** The US/CA **LocaleToggle is
  now live** in the header (desktop + mobile, `aria-pressed`) and `t()` has real
  call sites — so the "switched-off mechanism" is already reused and on, and the
  CAN dictionary spelling is correct (not British). M27 (inactive-brand labels)
  and M24 (no-results copy) are FIXED. **Remaining (the actual Priority 3):**
  region-aware product **prioritization**, **dashboard-managed forgiving filter
  tags** (typo/case/space tolerant), and routing the last few hard-coded
  spellings (`StudioClient.tsx:232`, `my-quote-client.tsx:363`) through `t()`.
- **Priority 4 — NEW BUILD, not started.** Footer "Collections" is no longer
  fake (M21 FIXED: real category deep-links), but the actual feature — public
  Collections page, dashboard collection builder, and the three-dots **Export**
  (PDF/XLSX/CSV/TXT/MD) for Mailchimp — does not exist yet. Depends on the
  Part B Mailchimp research.
- **Priority 5 — accessibility largely DONE.** B5 (real dialogs), M13–M20
  (keyboard, labels, live regions, autocomplete, headings, CMS logo) all FIXED;
  the selected-filter left-bar is now consistent. **Remaining:** CTA contrast
  ~3.7:1 < AA 4.5:1 on `bg-[#ef473f] text-white` (H5); Gender filter group
  missing the `focus-visible` ring its siblings have (L13); broader polish.

---

## 5. Quick mechanical wins (safe, small, low-risk)

- Bump `next` → `16.2.9` (see §0).
- Gender filter `focus-visible` ring (`StudioClient.tsx:174`) to match Category/Brand.
- `tel:` hrefs missing `+1` (E.164) in `lib/cms/locale.ts:51,61,70,101,111`.
- Remove 3 unused `images.remotePatterns` hosts in `next.config.mjs` (blob + 2 GitHub).
- Add a `packageManager` pin to `package.json`.
- Fix stale "10,000-char" comment (`my-quote-client.tsx:460-462` → 16,000).
- Delete confirmed dead exports (L11): `getProductBySku/getCategories/getBrands/
  getGenders`, `getFeaturedBrands`, `brandLogos` getter, `IMAGE_REGISTRY*`/
  `getImageDefault`; either render or drop `brands.website_url`.
- De-stale `docs/runbooks/archived/README.md:6-8` false cross-references (M28).

---

## 6. Audit gaps (not separately confirmed by this pass)

These weren't individually returned by the cluster auditors — verify before
relying on them either way: **M12** (loading states / `loading.tsx`), **L1/L2**
(product-level image sort-order + whether product-level images render anywhere),
**L9** (unused dependencies — `components/ui` is intentionally kept per CLAUDE.md).
