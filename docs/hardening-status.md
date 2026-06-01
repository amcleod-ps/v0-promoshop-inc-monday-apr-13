# Hardening status & session handoff

> Living status doc so a fresh Claude Code session (or any contributor) can resume
> without the prior chat context. Pairs with `CLAUDE.md` (architecture) and
> `docs/promoshop-research.md` (company + codebase dossier).
>
> Work now lands on `main` via short single-purpose PRs (current dev branch:
> `claude/gracious-wright-dTuVl`). · Last updated 2026-06-01.

## TL;DR for the next session
A multi-step security/correctness hardening pass is in flight. All Critical/High
fixes **and** the two High/structural items are now **merged to `main`**
(PRs #13, #15, #17, #18); a prioritized Medium/Low backlog remains (below).
`/admin-dashboard` authentication is **deferred at the client's request**. The
production Supabase is healthy and fully migrated. Build/type-check gate is
`pnpm build` (`pnpm lint` is still broken — see backlog).

## ✅ Done & merged to `main`
**PR #13** (merge `6096c18`):
- **`CLAUDE.md`** — architecture & conventions; **`docs/promoshop-research.md`** — deep-research dossier.
- **C1 + H5** — `/my-quote` now actually submits (was a no-op `setSubmitted(true)` that silently dropped **every** quote lead); calls `submitQuoteRequest()` and serialises the cart into `message`.
- **H2** — admin image-upload hardening. `lib/image-upload.ts` sniffs magic bytes and allowlists raster formats (PNG/JPEG/WebP/GIF/AVIF), rejecting **SVG / spoofed-MIME** (stored-XSS) across all 3 upload paths.
- **H3** — `getAllProducts()` wrapped in try/catch (returns `[]`), so `/studio` and `/brands/[slug]` no longer 500 when Supabase is unreachable; `/studio` falls back to the static catalog.
- **H4** — `/brands/[slug]` matches products by stable **slug**, not display name; `getAllProducts` exposes `brandSlugs`.

**PR #15** (merge `74e6320`):
- **#2 — `/admin-dashboard` auto-refresh**: every create flow (brand, hero slide, site-image slot, product, colour, product image, team member) calls `router.refresh()` so new rows appear immediately.
- **#4 — brand-logo dual-write error surfaced**: `writeImageUrl`/`removeImage` capture & propagate the `site_images['brand.<slug>.logo']` override write's error, so a logo replace can't report "Saved" while the public site keeps the old logo.
- This handoff doc.

**PR #17** (merge `cba7014`):
- **#3 — `/brands/[slug]` reads live Supabase** via `getSupabaseBrandBySlug` (active brand by slug, logo cache-busted), falling back to the static seed when Supabase is unreachable or the slug exists only in the seed. Dashboard-created brands now resolve on the detail page; name/description/logo edits show there. (Verified live: seeded brands render, unknown slug 404s, no 500s, route stays dynamic.)

**PR #18** (merge `ec0ef83`):
- **Studio product cards keyboard-accessible** — `components/studio/product-card.tsx` gains `role="button"`, `tabIndex`, an Enter/Space `onKeyDown` activator (Space `preventDefault`-ed), an `aria-label`, and a focus ring (all gated on `onClick`). The core "open product → add to quote" flow is now keyboard/AT-operable. (Verified end-to-end in Chromium: Tab → focus ring → Enter/Space open the modal, no scroll, mouse unaffected.)

## Production infrastructure (verified live during the original session)
- **Supabase:** project **`promoshopstudio`**, ref **`rfvnjxrhainbldxtzdfb`** — the **client's** account. (Note: the Supabase MCP in these sessions is connected to a *different* "Nest Digital" account holding unrelated `GMS`/`landalgorithm` projects — do not confuse them, and don't query them. Live re-verification of the client DB isn't available from that MCP.)
- **Migrations `0001`–`0005` are all applied.** Verified live: `team_members`=4, `site_theme`=4, readable by the anon role; the dashboard's "migration not applied" banner is gone.
- **Storage:** the `site-images` bucket exists, is public, has no size/MIME cap, accepts service-role uploads.
- **Server Actions:** the 10 MB `serverActions.bodySizeLimit` is in `next.config.mjs`.
- **Vercel:** the project builds under the **"Nest Digital Solutions Inc"** team. The client may also run their own Vercel/domain (`promoshopstudio.com`) — confirm which is production.
- **The GitHub repo is PUBLIC.** No secret key values are committed (verified). Keep all keys in Vercel env vars only.

## Remaining backlog (prioritized)

### High / structural
- [ ] ⏸️ **Authenticate `/admin-dashboard` — DEFERRED at the client's request (2026-06-01).** The dashboard stays unauthenticated for now; revisit only when the client asks. (Risk on record: it wields the **service-role key** and the repo is public, so the URL-as-secret path is discoverable. When picked up: Basic auth / a gate / Vercel password.)

### Medium
- [ ] Open redirect on `/sign-in` & `/sign-up` — `?redirect=` is pushed unvalidated; restrict to same-origin (`startsWith("/") && !startsWith("//")`). *(next up)*
- [ ] Quote-cart `localStorage` is parsed without shape validation (`lib/quote-context.tsx`) — guard `Array.isArray(items)` + spread over defaults to avoid de-controlled inputs / crashes on stale data.
- [ ] Duplicate detection uses `error.message.includes("duplicate")` (`create-actions.ts`) → branch on SQLSTATE `error.code === "23505"`.
- [ ] `sort_order` "read-max-then-+1" race on every create action.
- [ ] `scripts/generate-seed-sql.ts` `sqlTextArray` doesn't escape single quotes — regenerating `0003_seed_data.sql` breaks if any `text[]` value gains an apostrophe (latent; no current seed value has one).
- [ ] Public `quote_requests` insert has no length caps / rate-limiting — add Zod `.max()` + DB `CHECK` + captcha.
- [ ] Product modal keys colours by `name` (duplicate names break multi-select); guest "add to quote" discards the selection at the sign-up gate. *(The product-card keyboard a11y half of this cluster shipped in PR #18.)*

### Low / robustness & polish
- [ ] `createProductImage` `label.trim()` needs a `typeof` guard (`create-actions.ts`) — `TypeError` if called without a label.
- [ ] Client-side image `accept=` raster allowlist + size pre-check; brand-slug client normalization; hex text `maxLength` 9→7 (8-digit hex the server rejects).
- [ ] Paginate the 9 `/admin-dashboard` queries — PostgREST's 1000-row default silently truncates at scale (esp. `product_images`).
- [ ] `updateTeamMemberText` allows empty name/role; deletes orphan their storage objects; soft-delete has no in-UI reactivation.
- [ ] **ESLint flat-config repair** — `pnpm lint` is broken repo-wide (no `eslint.config.js`; ESLint 9+ needs flat config; eslint isn't even in devDependencies). Rely on `pnpm build` for type-checking meanwhile.
- [ ] a11y: several inputs are labelled by a sibling `<div>` rather than a real `<label>` (`text-row.tsx`, `image-row.tsx`). (Note: `create-forms.tsx` & `team-tab.tsx` already use proper `<label>`.) A real dialog role + focus management for the studio product modal would also be a good a11y follow-up.

### Content gaps (not bugs, for the client)
- [ ] 9 of 20 brands have no logo (render the text wordmark); 29 of 46 `site_images` slots are empty (mostly the intentional opt-in lifestyle/slideshow slots).

## Security / credentials
- [ ] Rotate the Supabase API keys before go-live and keep them **only** in Vercel env vars (never committed, never shared in plaintext). No keys are committed in this repo (verified).

## How to verify / continue
- **Build/type gate:** `pnpm build` (also runs `tsc`). There is no test framework.
- **Runtime verify:** run `pnpm start` and drive the real surface (HTTP for server routes; Playwright/Chromium for keyboard/GUI behavior). No `.env.local` → the static-seed fallback path executes (no live Supabase).
- **DB/storage state:** query the live project as the **anon** role (the public path) or service role; the `?v=<updated_at>` + `force-dynamic` contract means edits show on the next request.

## Key references
- `CLAUDE.md` — architecture & conventions
- `docs/promoshop-research.md` — company + codebase dossier
- Merged PRs: #13 (C1/H2/H3/H4 + docs), #15 (#2/#4), #17 (#3 brands/[slug] live), #18 (product-card a11y)
- Issue #16 — the hardening-backlog tracking issue (checklist mirror of the backlog above)
