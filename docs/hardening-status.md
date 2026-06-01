# Hardening status & session handoff

> Living status doc so a fresh Claude Code session (or any contributor) can resume
> without the prior chat context. Pairs with `CLAUDE.md` (architecture) and
> `docs/promoshop-research.md` (company + codebase dossier).
>
> Branch: `claude/great-pasteur-HkSRi` · Last updated from the hardening session.

## TL;DR for the next session
A multi-step security/correctness hardening pass is in flight. The Critical/High
fixes are **merged to `main`** (PR #13); two more dashboard fixes are **on this
branch awaiting a new PR**; a prioritized backlog remains (below). The production
Supabase is healthy and fully migrated. Build/type-check gate is `pnpm build`
(`pnpm lint` is currently broken — see backlog).

## ✅ Done & merged to `main` (PR #13, merge commit `6096c18`) — deploying to production
- **`CLAUDE.md`** — architecture & conventions.
- **`docs/promoshop-research.md`** — deep-research dossier (the company + full back/front-end map).
- **C1 + H5** — `/my-quote` now actually submits. It was a no-op (`setSubmitted(true)` only) that silently dropped **every** quote lead; now calls `submitQuoteRequest()` and serialises the cart into `message`.
- **H2** — admin image-upload hardening. `lib/image-upload.ts` sniffs magic bytes and allowlists raster formats (PNG/JPEG/WebP/GIF/AVIF), rejecting **SVG / spoofed-MIME** (stored-XSS vector) across all 3 upload paths. Content-Type/extension derived from sniffed bytes, never the client.
- **H3** — `getAllProducts()` wrapped in try/catch (returns `[]`), so `/studio` and `/brands/[slug]` no longer 500 when Supabase is unreachable; `/studio` falls back to the static catalog.
- **H4** — `/brands/[slug]` matches products by stable **slug**, not display name (rename-proof); `getAllProducts` now exposes `brandSlugs`.

## 🔶 On this branch, NOT yet merged (covered by the open PR for this branch)
- **#2 — `/admin-dashboard` auto-refresh** (`9a3469c`): every create flow (brand, hero slide, site-image slot, product, colour, product image, team member) calls `router.refresh()` so new rows appear immediately instead of needing a manual reload.
- **#4 — brand-logo dual-write error surfaced** (`56c8784`): `writeImageUrl`/`removeImage` now capture & propagate the `site_images['brand.<slug>.logo']` override write's error, so a logo replace can't report "Saved" while the public site keeps the old logo.
- **This doc.**

## Production infrastructure (verified live during the session)
- **Supabase:** project **`promoshopstudio`**, ref **`rfvnjxrhainbldxtzdfb`** — the **client's** account. (Note: the Supabase MCP in the session was connected to a *different* "Nest Digital" account holding unrelated `GMS`/`landalgorithm` projects — do not confuse them.)
- **Migrations `0001`–`0005` are all applied.** `0005` (team_members + site_theme) was applied this session; verified live: `team_members`=4, `site_theme`=4, readable by the anon role, and the dashboard's "migration not applied" banner is gone.
- **Storage:** the `site-images` bucket exists, is public, has no size/MIME cap, and accepts service-role uploads (verified with a live upload + public read).
- **Server Actions:** the 10 MB `serverActions.bodySizeLimit` is in `next.config.mjs` (in production) — needed for the uploader.
- **Vercel:** the project builds under the **"Nest Digital Solutions Inc"** team. The client may also run their own Vercel/domain (`promoshopstudio.com`) — confirm which one is production.
- **The GitHub repo is PUBLIC.** No secret key values are committed (verified). Keep all keys in Vercel env vars only.

## Remaining backlog (prioritized)

### High / structural
- [ ] **#3 — point `/brands/[slug]` at Supabase instead of the static seed.** Today the detail page reads `getBrandBySlug` (compiled-in seed), so **dashboard-created brands 404** there and **brand name/description/logo edits don't show** (only the live listing reflects them). Resolve the brand from the live `brands` table with the static seed as fallback.
- [ ] **Authenticate `/admin-dashboard`.** It's intentionally unauthenticated (URL-as-secret) but wields the **service-role key**, and the repo is public so the path is discoverable. Highest-leverage security hardening (e.g. Basic auth / a gate / Vercel password).

### Medium
- [ ] Open redirect on `/sign-in` & `/sign-up` — `?redirect=` is pushed unvalidated; restrict to same-origin (`startsWith("/") && !startsWith("//")`).
- [ ] Quote-cart `localStorage` is parsed without shape validation (`lib/quote-context.tsx`) — guard `Array.isArray(items)` + spread over defaults to avoid de-controlled inputs / crashes on stale data.
- [ ] Duplicate detection uses `error.message.includes("duplicate")` (`create-actions.ts`) → branch on SQLSTATE `error.code === "23505"`.
- [ ] `sort_order` "read-max-then-+1" race on every create action.
- [ ] `scripts/generate-seed-sql.ts` `sqlTextArray` doesn't escape single quotes — regenerating `0003_seed_data.sql` breaks if any `text[]` value gains an apostrophe.
- [ ] Public `quote_requests` insert has no length caps / rate-limiting — add Zod `.max()` + DB `CHECK` + captcha.
- [ ] `studio/product-card.tsx` is a clickable `<div>` (no `role`/`tabIndex`/keydown) → the core add-to-quote flow is unreachable by keyboard/AT.
- [ ] Product modal keys colours by `name` (duplicate names break multi-select); guest "add to quote" discards the selection at the sign-up gate.

### Low / robustness & polish
- [ ] `createProductImage` `label.trim()` needs a `typeof` guard (`create-actions.ts`) — `TypeError` if called without a label.
- [ ] Client-side image `accept=` raster allowlist + size pre-check; brand-slug client normalization; hex text `maxLength` 9→7 (8-digit hex the server rejects).
- [ ] Paginate the 9 `/admin-dashboard` queries — PostgREST's 1000-row default silently truncates at scale (esp. `product_images`).
- [ ] `updateTeamMemberText` allows empty name/role; deletes orphan their storage objects; soft-delete has no in-UI reactivation.
- [ ] **ESLint flat-config repair** — `pnpm lint` is broken repo-wide (no `eslint.config.js`; ESLint 9+ needs flat config). Rely on `pnpm build` for type-checking meanwhile.
- [ ] a11y: several inputs are labelled by a sibling `<div>` rather than a real `<label>` (`text-row.tsx`, `image-row.tsx`).

### Content gaps (not bugs, for the client)
- [ ] 9 of 20 brands have no logo (render the text wordmark); 29 of 46 `site_images` slots are empty (mostly the intentional opt-in lifestyle/slideshow slots).

## Security / credentials
- [ ] Rotate the Supabase API keys before go-live and keep them **only** in Vercel env vars (never committed, never shared in plaintext). No keys are committed in this repo (verified).

## How to verify / continue
- **Build/type gate:** `pnpm build` (also runs `tsc`). There is no test framework.
- **DB/storage state:** query the live project as the **anon** role (the public path the site uses) or the service role; the `?v=<updated_at>` + `force-dynamic` contract means edits show on the next request.
- The detailed code-review (Critical→Low) and admin-dashboard deep-audit that produced this backlog live in the session history; the durable summaries are this doc + `docs/promoshop-research.md`.

## Key references
- `CLAUDE.md` — architecture & conventions
- `docs/promoshop-research.md` — company + codebase dossier
- PR #13 (merged) — C1/H2/H3/H4 + docs · the open PR on this branch — #2/#4 + this doc
- The hardening-backlog tracking issue (checklist mirror of the backlog above)
