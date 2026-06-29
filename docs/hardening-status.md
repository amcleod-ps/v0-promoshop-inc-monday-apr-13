# Hardening status & session handoff

> Living status doc so a fresh Claude Code session (or any contributor) can resume
> without the prior chat context. Pairs with `CLAUDE.md` (architecture) and
> `docs/promoshop-research.md` (company + codebase dossier).
>
> Work lands on `main` via short single-purpose PRs. · Last updated 2026-06-13.

## TL;DR for the next session
The big 2026-06-10 merge train landed: the admin-dashboard functionality/
hardening pass (#31) plus its satellites (#23, #26, #27, #29, #30), the slimmed
quote-flow hardening (#28), the dormant admin auth gate (#32), and three small
follow-ups (#33, #34, #35). Stale PRs #2/#22/#25 are closed (superseded).
Migrations 0001–0008 are all applied on the production Supabase
(0007 and 0008 both applied 2026-06-10, owner-confirmed). The one outstanding config step
is setting `ADMIN_DASHBOARD_PASSWORD` in Vercel to switch on the merged
admin gate. Build/type-check gate is `pnpm build`; **`pnpm lint` (ESLint 9
flat config) is restored and passing** — run both before pushing.

> **Update 2026-06-13 — launch-review pass (branch `claude/nifty-knuth-b7gtdr`).**
> A fresh end-to-end review (security/backend, data/CMS, frontend/UX/a11y,
> config/SEO/infra) ran on top of the post-2026-06-10 work (`pnpm lint`
> restored, admin production pass, full-site UI/UX hardening). Build + lint +
> a no-Supabase runtime smoke test of every route are green. Fixes landed in
> this pass: theme rebrand now covers the `/35` opacity used by the contact
> form's focus rings; quote-notification email normalizes all interpolated
> fields (reply-to header-injection defense-in-depth); `createProductImage`
> verifies the colour belongs to the product before uploading; `createSiteImage`
> / `updateSiteContent` cap the `label` field; mobile menu closes on
> route-change + Escape; ContactSection success-timer cleanup; explicit footer
> Quick-Links hrefs; stable team-grid keys; focus-visible rings on studio
> filters & quote tabs; non-interactive marquee duplicate run; global-error
> "Back to Home" escape; default OG/Twitter card image. Full report:
> `docs/launch-review-2026-06-13.md`. Remaining items are decision points
> (see that report) — chiefly the admin-gate env var and the merge approval.

> **Update 2026-06-15 — intensive security review (branch `security-review-jun15`).**
> Full-surface pass (scope excluded login/OAuth/DB/password setup per request).
> App code held up: no XSS/SQLi/IDOR/RLS/secret findings. Fixed in-branch
> (defense-in-depth + headers): sanitize-on-read for `brands.website_url` (latent
> open-redirect) and `hero_slides.bg_color` / `product_colours.hex` (CSS sinks);
> guarded the admin `image-row.tsx` "open in new tab" href; added HSTS,
> Permissions-Policy, COOP, X-Permitted-Cross-Domain-Policies, and CSP
> `object-src 'none'` + prod-only `upgrade-insecure-requests`.
> **ONE maintainer action outstanding (🔴 HIGH):** `next@16.2.0` matches **14
> OSV advisories** (incl. HIGH middleware/proxy-bypass that touches the admin
> gate, + SSRF/DoS). Couldn't auto-bump (no Node/pnpm in that session). Run
> `pnpm up next@16.2.9 && pnpm build && pnpm lint` — 16.2.9 is clean. Full
> report: `docs/security-review-2026-06-15.md`.

> **Update 2026-06-29 - master dev task closeout (branch `prereleasemasterdevtasks`).**
> H10 is closed in code: `/sign-in` and `/sign-up` no longer collect or discard
> passwords, and the public UI now describes the feature as a browser-saved
> quote profile rather than a real account. M23 is materially hardened by
> `0011_quote_id_and_product_image_order_hardening.sql`, which forces
> `quote_requests.id` server-side and adds a DB-side email throttle for direct
> PostgREST inserts. L1/L2 are closed: product-level images now order correctly
> when `colour_id IS NULL` and render as shared product galleries on the public
> catalog. M12/L8 received low-risk launch improvements: route loading shells,
> deferred Studio filtering, and memoized product cards.

## ✅ Done & merged to `main`
**PR #13** (merge `6096c18`):
- **`CLAUDE.md`** — architecture & conventions; **`docs/promoshop-research.md`** — deep-research dossier.
- **C1 + H5** — `/my-quote` now actually submits (was a no-op `setSubmitted(true)` that silently dropped **every** quote lead); calls `submitQuoteRequest()` and serialises the cart into `message`.
- **H2** — admin image-upload hardening. `lib/image-upload.ts` sniffs magic bytes and allowlists raster formats (PNG/JPEG/WebP/GIF/AVIF), rejecting **SVG / spoofed-MIME** (stored-XSS) across all 3 upload paths.
- **H3** — `getAllProducts()` no longer 500s `/studio` or `/brands/[slug]` when Supabase is unreachable; static-catalog fallback.
- **H4** — `/brands/[slug]` matches products by stable **slug**, not display name; `getAllProducts` exposes `brandSlugs`.

**PR #15** (merge `74e6320`): dashboard auto-refresh after creates; brand-logo dual-write errors surfaced; this handoff doc.

**PR #17** (merge `cba7014`): `/brands/[slug]` reads live Supabase via `getSupabaseBrandBySlug`.

**PR #18** (merge `ec0ef83`): studio product cards keyboard-accessible.

**PRs #19–#21** (merges `e5c3967`, `382cc7f`, `dfcce9d`): open-redirect guard on
`/sign-in`/`/sign-up` (`lib/auth/safe-redirect.ts`); quote-cart `localStorage`
shape-guarding.

**2026-06-10 merge train** (merges `1c8715d` → `d853282`):
- **#31 — admin dashboard functionality & hardening pass** (the big one):
  hero-slide subtitle/CTA overlay + `cta_url` validation + blank-slide skip;
  brand-logo rows removed from the generic Site Images section (dual-write
  path only); `team.*` editors hidden once `team_members` is populated; all
  dashboard reads paginate past PostgREST's 1000-row cap; zero-row updates
  report "row no longer exists"; `replaceImage` validates its target before
  storage writes; edit support for product name/category/description, brand
  categories, alt text, slide `bg_color`, and every `sort_order`;
  multi-brand product create; SQLSTATE-`23505` duplicate detection; replaced
  uploads pruned; upload rate limit; `0006_sort_order_triggers.sql` (atomic
  sort_order via BEFORE INSERT trigger + advisory lock, with a read-max+1
  fallback pre-migration); seed migration made admin-safe (fixed hero-slide
  UUIDs, keyed colour/image upserts, single-quote escaping, 0005 no longer
  overwrites admin team text); static fallback only on real Supabase errors
  (deactivating everything renders empty; soft-deleted brands 404); try/catch
  on every server-action call + client-side 10 MB pre-check; `site_images.alt_text`
  rendered via `<SiteImage>`; baseline security headers (CSP, `X-Frame-Options:
  DENY`, nosniff, Referrer-Policy); robots.txt no longer names `/admin-dashboard`.
- **#23** — CLAUDE.md live-data table fix. **#26** — theme tab hex `maxLength`
  7, prop re-sync, aria-labels. **#27** — team card prop re-sync after sibling
  refresh. **#29** — client handoff guides (`docs/ADMIN-LOGIN-SETUP.md`,
  `docs/RESEND-EMAIL-SETUP.md`) + the Resend quote-notification hook
  (`lib/email/quote-notification.ts`, env-gated, fired via `after()`).
  **#30** — pre-launch code-review report (`docs/code-review-2026-06-10.md`).
- **#28 (slim rebase)** — quote-flow hardening: Zod `.trim()`/`.max()` caps on
  every quote field, hidden honeypot field on both public forms, per-IP
  in-memory rate limit (5/10 min, `lib/rate-limit.ts`), `/my-quote` submit
  guard requires `lastName`, and `0007_quote_request_hardening.sql` (DB CHECK
  backstop for direct PostgREST inserts).
- **#32** — **optional admin Basic-auth gate, shipped dormant**: `proxy.ts` +
  `lib/admin-auth*.ts` + per-action `requireAdminAction()` re-verification.
  Off until `ADMIN_DASHBOARD_PASSWORD` is set in Vercel.
- **#33** — `createProductImage` `label` typeof guard. **#34** — dashboard
  summary counts populated text fields. **#35** — team card re-syncs the
  display-order baseline.
- Closed without merging: **#2** (obsolete April README stub), **#22**
  (superseded by #31; its label guard became #33), **#25** (superseded by
  #31; its populated counting became #34).

## Production infrastructure
- **Supabase:** project **`promoshopstudio`**, ref **`rfvnjxrhainbldxtzdfb`** — the **client's** account. (Note: the Supabase MCP in these sessions is connected to a *different* "Nest Digital" account holding unrelated `GMS`/`landalgorithm` projects — do not confuse them, and don't query them. Live re-verification of the client DB isn't available from that MCP.)
- **Migrations `0001`–`0008` are all applied** (0007 and 0008 both applied 2026-06-10, owner-confirmed — note the sessions' Supabase MCP cannot see the client project, so this is recorded from the owner's confirmation, not a live query). **Migrations `0009`–`0011` still need to be applied in production** unless Abigail/Victor has separately run them after this handoff.
- **Storage:** the `site-images` bucket exists, is public, has no size/MIME cap, accepts service-role uploads. Replaced uploads are now pruned by the dashboard; removals deliberately keep the file for recovery.
- **Server Actions:** the 10 MB `serverActions.bodySizeLimit` is in `next.config.mjs`.
- **Vercel:** the project builds under the **"Nest Digital Canada Inc."** team. The client may also run their own Vercel/domain (`promoshopstudio.com`); confirm which is production.
- **The GitHub repo is PUBLIC.** No secret key values are committed (verified). Keep all keys in Vercel env vars only.

## Remaining backlog (prioritized)

### High / structural
- [ ] **Turn on the admin gate**: set `ADMIN_DASHBOARD_PASSWORD` in Vercel (Production + Preview). The code shipped dormant in #32; until the var is set, the dashboard stays URL-as-secret while wielding the service-role key. (Client originally deferred auth on 2026-06-01; the owner merged the opt-in gate on 2026-06-10 — flipping it on is now a pure config decision.)

### Medium
- [ ] Product modal keys colours by `name` (duplicate names break multi-select). The old guest add-to-quote selection-loss bug is fixed: selections are added to the local cart before the saved-profile pass-through.
- [ ] A real captcha (Turnstile/hCaptcha) on the quote form for determined bots — the honeypot + rate limit from #28 blunt scripted spam but aren't a captcha.

### Low / robustness & polish
- [ ] Client-side image `accept=` raster allowlist (inputs still say `image/*`; the 10 MB pre-check shipped in #31); brand-slug client normalization.
- [ ] `updateTeamMemberText` allows empty name/role; hard deletes (product images, colours) orphan their storage objects; soft-delete has no in-UI reactivation.
- [x] **ESLint flat-config repair** — DONE. `eslint@9` + `eslint-config-next` are in devDependencies and `eslint.config.mjs` (flat config) exists; `pnpm lint` passes clean. Both `pnpm build` and `pnpm lint` are correctness gates again (matches CLAUDE.md).
- [ ] a11y: several inputs are labelled by a sibling `<div>` rather than a real `<label>` (`text-row.tsx`, `image-row.tsx`). (Note: `create-forms.tsx` & `team-tab.tsx` already use proper `<label>`.) A real dialog role + focus management for the studio product modal would also be a good a11y follow-up.
- [ ] `docs/code-review-2026-06-10.md` findings not covered above (legal pages, newsletter, brand-red contrast, production-domain choices) — mostly client-decision or content items; triage with the client.

### Content gaps (not bugs, for the client)
- [ ] 9 of 20 brands have no logo (render the text wordmark); many `site_images` slots are empty (mostly the intentional opt-in lifestyle/slideshow slots).

## Security / credentials
- [ ] Rotate the Supabase API keys before go-live and keep them **only** in Vercel env vars (never committed, never shared in plaintext). No keys are committed in this repo (re-verified 2026-06-09: git history clean of JWTs/.env.local).
- [ ] **Set `ADMIN_DASHBOARD_PASSWORD` in Vercel** to enable the (already merged) admin gate.
- [ ] (optional) Set `RESEND_API_KEY` + `QUOTE_NOTIFICATION_EMAIL` (and `QUOTE_NOTIFICATION_FROM` once the domain is verified) so new quote requests email the owner — see `docs/RESEND-EMAIL-SETUP.md`. Without them, leads still persist to `quote_requests`.
- [ ] Run Supabase → Advisors (security) on the real `promoshopstudio` project before go-live (not reachable from these sessions' MCP).

## How to verify / continue
- **Build/type gate:** `pnpm build` (also runs `tsc`). There is no test framework.
- **Runtime verify:** run `pnpm start` and drive the real surface (HTTP for server routes; Playwright/Chromium for keyboard/GUI behavior). No `.env.local` → the static-seed fallback path executes (no live Supabase).
- **DB/storage state:** query the live project as the **anon** role (the public path) or service role; the `?v=<updated_at>` + `force-dynamic` contract means edits show on the next request.

## Key references
- `CLAUDE.md` — architecture & conventions
- `docs/promoshop-research.md` — company + codebase dossier
- `docs/code-review-2026-06-10.md` — 34-finding pre-launch review (input to #31)
- `docs/ADMIN-LOGIN-SETUP.md` / `docs/RESEND-EMAIL-SETUP.md` — client handoff guides
- Merged PRs: #13, #15, #17–#21, then the 2026-06-10 train: #23, #26, #27, #29, #30, #31, #28, #32, #33, #34, #35
- Issue #16 — the hardening-backlog tracking issue (update its checklist to match the backlog above)
