# Security review — 2026-06-15

> Intensive, full-surface security review of the PromoShop site on branch
> `security-review-jun15`. Scope per request: **everything except login/OAuth/
> separate-database/password setup**, which are recorded below as deferred
> context rather than acted on. Pairs with `docs/launch-review-2026-06-13.md`
> (prior pass) and `docs/hardening-status.md` (living status).
>
> **Reviewer constraint:** this environment has **no Node/pnpm toolchain and no
> network package manager**, so `pnpm build` / `pnpm lint` / `pnpm audit` could
> not be run here. Code fixes were kept minimal and type-checked by inspection;
> **run `pnpm build` + `pnpm lint` in CI before merge** (both are the project's
> correctness gates). Dependency advisory data was pulled live from OSV.dev.

## TL;DR

The application code is already well-hardened from the 06-10 and 06-13 passes
(magic-byte upload sniffing, RLS lock-down, sanitize-on-read for hero `cta_url`
/ theme CSS / image-fit, Zod + DB-CHECK quote validation, honeypot + rate limit,
per-action admin re-auth, generic admin errors, baseline CSP/security headers).

This pass found **one high-severity item that needs a maintainer action** — the
**Next.js version is affected by 14 published advisories** (multiple HIGH
middleware/proxy-bypass + SSRF + DoS) — plus a handful of **low/defense-in-depth
gaps** that were **fixed in code automatically**. No exploitable XSS, SQLi,
secret leakage, IDOR, or RLS hole was found in the application itself.

---

## 1. Findings requiring a maintainer action (could not be auto-applied here)

### 🔴 H-1 — Next.js 16.2.0 is affected by 14 known CVEs (incl. HIGH middleware/proxy bypass)
- **Location:** `package.json` → `next@16.2.0` (+ `pnpm-lock.yaml`).
- **Evidence (OSV.dev, queried 2026-06-15):** 16.2.0 matches 14 advisories,
  including four HIGH **middleware/proxy-bypass** CVEs that are *directly*
  relevant because the admin gate is implemented as middleware (`proxy.ts`):
  - `CVE-2026-44575` / `GHSA-267c-6grr-h53f` — **HIGH** middleware-bypass via
    segment-prefetch `.rsc` routes.
  - `CVE-2026-45109` / `GHSA-26hh-7cqf-hhc6` — **HIGH** follow-up to the above
    (incomplete-fix); still present in 16.2.5.
  - `CVE-2026-44574` / `GHSA-492v-c6pp-mqqv` — **HIGH** bypass via dynamic
    route-parameter injection.
  - `CVE-2026-44573` / `GHSA-36qx-fr4f-26g5` — **HIGH** Pages-Router i18n bypass
    (N/A here — App Router — but fixed in the same bump).
  - `CVE-2026-44578` / `GHSA-c4j6-fc7j-m34r` — **HIGH** SSRF via WebSocket
    upgrades. Plus several HIGH/MODERATE DoS (Server Components, Image
    Optimization API, cache-component connection exhaustion), two App-Router XSS
    (CSP-nonce / `beforeInteractive`), and cache-poisoning (LOW/MODERATE).
- **Impact:** the proxy-bypass class can let a crafted `.rsc`/segment-prefetch
  URL reach a middleware-gated page **without** the `ADMIN_DASHBOARD_PASSWORD`
  Basic-auth challenge. **Partially mitigated already**: every admin *server
  action* independently re-checks auth via `requireAdminAction()`, so write
  operations stay protected even if the page gate is bypassed; and the gate is
  off by default today (URL-as-secret). The SSRF/DoS CVEs are independent of the
  gate.
- **Fix (maintainer):** upgrade to the latest 16.2.x — **`16.2.9`** is clean of
  all 14 (16.2.5 still carries `GHSA-26hh-7cqf-hhc6`). `eslint-config-next` is
  already `^16.2.9`, so they align.
  ```bash
  pnpm up next@16.2.9        # regenerates pnpm-lock.yaml
  pnpm build && pnpm lint    # verify
  ```
- **Why not auto-applied:** this environment has no Node/pnpm, and hand-editing
  `pnpm-lock.yaml` (new integrity hashes for `next` + every `@next/swc-*`
  platform binary) would be unsafe and likely break the frozen-lockfile install
  Vercel uses. This is a one-command fix for the maintainer.

---

## 2. Findings fixed automatically in this branch

| # | Severity | Location | Issue | Fix |
|---|----------|----------|-------|-----|
| F-1 | Low (latent) | `lib/supabase/data.ts` `getSupabaseBrands` / `getSupabaseBrandBySlug` | `brands.website_url` (Table-Editor-writable, no read validation) is fetched and propagated to brand pages. Not yet rendered into an `href`, but the day a "Visit site" link is added, a stored `javascript:`/`//evil` value becomes clickable XSS / open redirect — the exact class the existing `cta_url` guard prevents. | Sanitize on read with `isSafeLinkTarget(...)` (already imported), mirroring the `cta_url` pattern. |
| F-2 | Low/Medium | `app/admin-dashboard/image-row.tsx` | `<a href={previewUrl} target="_blank">` where `previewUrl` is seeded from `site_images.url`. A Table-Editor-set `javascript:` / `data:text/html` URL is a clickable link inside the dashboard. | Render the link only when `isSafeLinkTarget(previewUrl)`; also upgraded `rel` to `noopener noreferrer`. |
| F-3 | Low (cosmetic) | `lib/supabase/data.ts` `getHeroSlides` | `hero_slides.bg_color` flows raw into `style={{ backgroundColor }}`. Not XSS (React object-style sets via CSSOM, which rejects malformed values), but unvalidated. | Sanitize on read to a strict hex (`null` otherwise) via new `safeHexColor()`. |
| F-4 | Low (cosmetic) | `lib/supabase/products.ts` `getAllProducts` | `product_colours.hex` flows raw into `style={{ backgroundColor }}` (product card + modal). Same CSSOM-safe-but-unvalidated situation. | Sanitize on read to a strict hex with neutral-grey fallback via new `safeHex()`. |
| F-5 | Hardening | `next.config.mjs` | Missing response-header hardening the request explicitly called out (TLS/SSL, headers, CSP). | Added **HSTS** (`max-age=63072000; includeSubDomains`), **Permissions-Policy** (deny camera/mic/geo/payment/usb/browsing-topics), **Cross-Origin-Opener-Policy** (`same-origin-allow-popups`), **X-Permitted-Cross-Domain-Policies: none**, and tightened the **CSP** with `object-src 'none'` + `upgrade-insecure-requests` (production-only so it can't break http://localhost dev). |

All fixes are read-side/defense-in-depth or pure config; none change app behavior
for legitimate data, and none touch authentication code.

---

## 3. Verified solid (no action needed)

- **RLS / access control:** every content table (`brands`, `hero_slides`,
  `products`, `product_colours`, `product_images`, `site_images`, `site_content`,
  `team_members`, `site_theme`) is **SELECT-only** for `anon`/`authenticated`;
  writes require the service-role key. `quote_requests` is **INSERT-only** for
  anon (no SELECT → submitters can't read others' leads), with a `status='new'
  and admin_notes is null` write-check, length CHECK backstops (0007), and
  server-forced timestamps (0008). Storage `site-images` bucket is public-read,
  service-role-write.
- **Admin server actions:** all **31** exported actions in `actions.ts` /
  `create-actions.ts` gate on `requireAdminAction()` / `adminOrError()` **before**
  any privileged work (verified action-by-action). Server actions are reachable
  by Next-Action id from any route, and this closes that. Raw Postgres/Storage
  errors are logged server-side and replaced with generic messages
  (`adminActionError`).
- **Upload safety:** `validateImageUpload` sniffs magic bytes and allowlists
  raster formats (PNG/JPEG/WebP/GIF/AVIF) — SVG/HTML/spoofed-MIME rejected;
  stored ext + content-type derived from sniffed bytes, never the filename.
  10 MB cap; storage paths sanitized (`[^a-z0-9._-]→_`) so no path traversal.
- **XSS sinks:** the only `dangerouslySetInnerHTML` on the public site is the
  theme `<style>` in `app/layout.tsx`, fed solely by `themeOverrideCss()` which
  emits CSS built from hard-coded keys/props and `SAFE_HEX`-validated values —
  DB `value`/`label`/`key` cannot break out of the `<style>` context. All
  DB/admin text elsewhere renders as React-escaped children. Hero `cta_url`
  validated on read; image URLs reach only `next/image`/`<img>` `src`
  (`javascript:` inert there).
- **Open redirect:** `lib/url-safety.ts` (`isSafeLinkTarget`) and
  `lib/auth/safe-redirect.ts` (`toSafeRedirect`) both reject `javascript:`,
  `data:`, `//host`, and the `/\host` backslash trick.
- **Email integration:** `sendQuoteNotification` collapses newlines in every
  interpolated field (reply-to header-injection defense), 10s timeout,
  best-effort via `after()`, server-only, no-ops when env unset.
- **Secrets / bundle boundary:** `SUPABASE_SERVICE_ROLE_KEY` is used only in the
  `server-only` admin client; no `'use client'` file imports it; no secret is
  exposed under `NEXT_PUBLIC_`; no secret values are committed (git-grep clean —
  only doc references); only `.env.example` is tracked.
- **CI/CD / infra:** no `.github` workflows, `vercel.json`, or Dockerfile —
  deployment is Vercel's zero-config git integration, so there is no pipeline
  script surface to harden. `proxy.ts` correctly matches the Next 16 middleware
  rename (`middleware.ts`→`proxy.ts`, Node runtime), so the gate is wired (modulo
  H-1).
- **Error handling:** `app/error.tsx` / `global-error.tsx` / `not-found.tsx`
  show branded pages and never render the error to the user.
- **Dependencies (besides Next):** `@supabase/supabase-js@2.104.0`,
  `@supabase/ssr@0.10.2`, `zod@3.24.1`, `react-dom@19.2.4` — **no known OSV
  advisories**.

---

## 4. Deferred — out of scope per request (login / OAuth / DB / passwords)

Recorded for future handling; **not changed** in this pass.

- **Admin dashboard is unauthenticated by default (URL-as-secret).** The repo is
  **public**, so the `/admin-dashboard` path is effectively known. The optional
  HTTP Basic gate already exists in code — enabling it is a one-line config:
  set **`ADMIN_DASHBOARD_PASSWORD`** in Vercel (Production + Preview). This is
  also the cleanest compensating control for H-1's page-gate-bypass class.
  *(Auth toggle — owner decision; deliberately not flipped here.)*
- **Customer "auth" (`/sign-in`, `/sign-up`, `AuthProvider`) is localStorage-only**
  — UI personalization, not access control. Any real account system (passwords,
  OAuth, Supabase Auth) is a separate project and explicitly out of scope.
- **No separate/authenticated database for quote leads beyond Supabase** — also
  out of scope. Current `quote_requests` RLS is correct for the public form.
- **Rotate Supabase API keys before go-live** and keep them in Vercel env only
  (carried over from `hardening-status.md`).
- **Run Supabase → Advisors (security)** on the live `promoshopstudio` project
  (not reachable from this session's MCP).

## 5. Optional follow-ups (not security-critical, no decision forced)

- **Rate-limit IP source:** `app/actions/quotes.ts` keys on
  `x-forwarded-for`.split(",")[0]`. On Vercel this is the client IP, but for
  belt-and-suspenders consider `x-real-ip` / `x-vercel-forwarded-for`. Best-effort
  in-memory limiter is per-instance by design — swap for Upstash/Redis if
  cross-instance limiting is ever needed.
- **CSP `script-src`/`style-src` still use `'unsafe-inline'`** (required by
  Next's inline runtime + the theme `<style>`). A nonce pipeline would let you
  drop it; that's a larger change, out of scope for a baseline.
- **A real captcha (Turnstile/hCaptcha)** on the quote form for determined bots
  (carried over) — honeypot + rate limit blunt scripted spam but aren't a captcha.
