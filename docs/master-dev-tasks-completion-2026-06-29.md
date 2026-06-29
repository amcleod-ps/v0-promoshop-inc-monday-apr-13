# PromoShop Studio master dev tasks completion report

Date: 2026-06-29
Branch: `prereleasemasterdevtasks`
Source task file: `/Users/vnesteanu/Downloads/PromoShop-Studio-Master-Dev-Tasks.md`

## Executive status

The master development tasks are complete in code and verified locally. The remaining launch blockers are operational or client-owned: apply migrations `0009` through `0011` in production, set the Vercel environment variables, rotate Supabase keys, enable the admin password, confirm the production domain, and supply legal/content assets.

This session did not invent legal policy copy, client imagery, or confirmed company/location copy. Those items remain explicit client-content gates because guessing would create a worse production risk than leaving them documented.

## What was already complete when this session started

The branch already contained the June 26 master-task implementation:

- Priority 2: dashboard copy editing, safe inline formatting, logo size control, product editing, no-size product handling, save-button layout fix, reseed-safe seed behavior, and stable team-photo lookup.
- Priority 3: Canada/United States toggle, forgiving canonical product tags, Studio tag filter, dashboard tag editing, no-results copy, and inactive-brand label fallback.
- Priority 4: Collections data model, public collection pages, dashboard collection builder, hand-picked plus saved-filter collection model, collection exports, and Mailchimp findings note.
- Priority 5: core accessibility fixes, real product/lightbox dialogs, stronger labels and focus behavior, selected-filter indicator consistency, and cross-device fixes.
- Part C launch backlog: Next.js upgraded to `16.2.9`, core security headers in place, lint restored, sitemap/robots/metadata present, crash screens present, storage writes guarded, quote funnel hardened, and the production Vercel/Supabase runbook present.

## Work completed in this session

### H10: faux account flow closed

Decision taken: keep the lightweight browser profile, but make it honest and stop collecting passwords.

Changes:

- Removed password and confirm-password fields from `/sign-up`.
- Removed password field from `/sign-in`.
- Replaced account/login wording with browser-saved quote-profile wording.
- Updated header calls to action from `Login / Register` to `Save Profile`.
- Updated sign-in and sign-up metadata.
- Updated quote-page contact copy to point visitors to `Save a profile`.

Files:

- `app/sign-in/page.tsx`
- `app/sign-in/layout.tsx`
- `app/sign-up/page.tsx`
- `app/sign-up/layout.tsx`
- `components/header.tsx`
- `app/my-quote/my-quote-client.tsx`
- `components/studio/product-detail-modal.tsx`

Review result: customer-facing code no longer claims a real account system, no longer collects a password it discards, and still preserves the quote pass-through flow.

### M23: direct quote insert hardening improved

Decision taken: close the low-cost database holes now, keep full captcha as a monitored post-launch escalation only if junk rows appear.

Changes:

- Added migration `0011_quote_id_and_product_image_order_hardening.sql`.
- Replaced the timestamp-only insert trigger with an insert-defaults trigger that forces `quote_requests.id`, `created_at`, and `updated_at` server-side.
- Added a small DB-side email throttle for direct PostgREST inserts: five quote rows per email address per ten minutes.
- Revoked public execution rights on the security-definer trigger function.

File:

- `supabase/migrations/0011_quote_id_and_product_image_order_hardening.sql`

Review result: direct inserts can no longer forge primary keys or timestamps, and simple repeated direct spam against one email address is blocked at the database boundary. This does not replace Turnstile/hCaptcha, but it materially improves launch posture without adding a new service dependency.

### L1/L2: product-level image flow closed

Changes:

- Fixed `assign_sort_order()` for scoped `NULL` values so `product_images.colour_id IS NULL` rows order as a real product-level group instead of all getting `sort_order = 0`.
- Public product rendering now treats product-level images as shared gallery images for each colour when colour-specific images are absent.
- Products with product-level images and no colours now get a safe `Default` display colour so the image can appear in cards, modals, collections, and exports.

Files:

- `supabase/migrations/0011_quote_id_and_product_image_order_hardening.sql`
- `lib/supabase/products.ts`

Review result: dashboard-created product-level images now have both database ordering and public rendering behavior.

### M12/L8: slow-network and catalog-scale improvements

Changes:

- Added shared page-loading skeletons and route loading states for the app shell, Studio, and My Quote.
- Deferred Studio search filtering with `useDeferredValue`.
- Memoized the shared public product card so list rerenders do less repeated work.
- Did not keep segment-level loading files for Brands or Collections because their dynamic slug pages already stream `notFound()` responses with `noindex`; adding segment loading would make that status behavior easier to miss in testing.

Files:

- `components/page-loading.tsx`
- `app/loading.tsx`
- `app/studio/loading.tsx`
- `app/my-quote/loading.tsx`
- `app/studio/StudioClient.tsx`
- `components/studio/product-card.tsx`

Review result: these are low-risk launch improvements. They do not change the force-dynamic data freshness contract, and they do not introduce pagination or a new data API before launch.

### Dependency surface hardened

Changes:

- Removed unused `components/ui/chart.tsx`, which eliminated the unused `recharts` dependency and its transitive Lodash advisory path.
- Updated `@supabase/supabase-js`, `autoprefixer`, `postcss`, and `tsx`.
- Added `pnpm-workspace.yaml` to record approved native build scripts and force the patched PostCSS version through pnpm overrides.
- Refreshed `pnpm-lock.yaml`.

Files:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `components/ui/chart.tsx`

Review result: `pnpm audit` now reports `No known vulnerabilities found`.

### Documentation updated

Changes:

- README now lists all eleven migrations and describes `/sign-in` and `/sign-up` as browser-local profile helpers, not customer auth.
- CLAUDE.md now records the profile-flow contract and migration `0011`.
- Production go-live checklist now includes migration `0011` and the saved-profile funnel smoke test.
- Hardening status now records the 2026-06-29 closeout and stops listing H10/M23/L1/L2/M12 as unresolved code gaps.
- This completion report records the full state and remaining launch gates.

Files:

- `README.md`
- `CLAUDE.md`
- `docs/runbooks/production-go-live.md`
- `docs/hardening-status.md`
- `docs/master-dev-tasks-completion-2026-06-29.md`

## Mailchimp research re-check

The existing Mailchimp decision still holds as of 2026-06-29:

- Mailchimp file imports are for contacts and audiences, not product collections.
- Product content blocks pull from a connected ecommerce store or Mailchimp Marketing API integration.
- The Marketing API product path requires products and variants inside an ecommerce store model.

Conclusion: the collection export should remain a flexible campaign brief, with CSV, Excel-readable spreadsheet output, Markdown, plain text, HTML, and print-to-PDF. HTML remains the most direct paste-into-campaign format without building a Mailchimp ecommerce integration.

Sources:

- https://mailchimp.com/help/import-contacts-mailchimp/
- https://mailchimp.com/help/format-guidelines-for-your-import-file/
- https://mailchimp.com/help/use-product-content-blocks-new-builder/
- https://mailchimp.com/help/use-product-content-blocks/
- https://mailchimp.com/developer/marketing/api/ecommerce-products/

## Final review

### Security

Passed in code:

- No new secret handling was added.
- No new `dangerouslySetInnerHTML` sink was added.
- Customer password collection was removed.
- Quote direct-insert hardening was added at the database layer.
- Dependency audit is clean: `pnpm audit` reports no known vulnerabilities.
- Existing admin server-action authorization remains unchanged.
- Product images still flow through the existing safe image path and fallback handling.

Remaining security/config gates:

- Set `ADMIN_DASHBOARD_PASSWORD` in Vercel before launch.
- Rotate Supabase anon and service-role keys before launch.
- Apply migrations `0009`, `0010`, and `0011` in the production Supabase project.
- Run Supabase Security Advisors in the client-owned project.

### Performance

Improved:

- Loading shells for slow page transitions.
- Deferred Studio filtering.
- Memoized product cards.
- Product-level image reuse avoids blank cards when generic images exist.

Remaining performance tradeoff:

- The app still serializes global CMS maps through root providers on every route. This is acceptable for the current catalog and CMS size, but server-side pagination/filtering and route-scoped CMS providers are the right post-launch scale pass.

### Functionality

Passed in code:

- Add-to-quote still routes visitors without a saved profile through `/sign-up?redirect=/my-quote`, with cart items already saved.
- Saved profile flow now pre-fills quote contact fields without password claims.
- Collections and Studio still reuse the same ProductCard/ProductDetailModal flow.
- Product-level images are now visible to the public product renderer.
- Unknown generic routes return HTTP 404. Unknown dynamic brand and collection slugs render the branded 404 UI with `noindex`, but report HTTP 200 in the local browser-style response because Next.js App Router commits status once streaming begins. Current Next.js docs describe this as expected streamed `notFound()` behavior.

Remaining content/functionality gates:

- Legal Privacy, Terms, and Shipping pages still need real client/legal copy before links and consent language should return.
- Hero/About/team/product imagery still needs client-supplied assets.
- About copy still needs confirmed client entity/location wording before hard-coding or seeding changes.
- Brand-red contrast remains a client brand decision unless the team accepts larger CTA text or a darker red.

## Verification log

Completed on 2026-06-29:

- `pnpm install`: passed after approving required native package build scripts for `esbuild`, `sharp`, and `unrs-resolver`.
- `pnpm audit`: passed with `No known vulnerabilities found`.
- `pnpm lint`: passed.
- `pnpm build`: passed on Next.js `16.2.9`.
- Production server smoke: `/`, `/studio`, `/collections`, `/my-quote`, `/sign-up`, `/sign-in`, `/admin-dashboard`, `/robots.txt`, and `/sitemap.xml` returned `200`.
- Unknown route smoke: `/definitely-not-a-real-page` returned `404`.
- Dynamic unknown slug smoke: `/brands/definitely-not-a-real-brand` and `/collections/definitely-not-a-real-collection` rendered branded 404 UI with `noindex`; response status was `200`, matching current Next.js streaming behavior.
- Security header smoke: CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, Permissions Policy, Referrer Policy, and COOP are present.
- Browser check: `/sign-up?redirect=/my-quote` has zero password fields, saves a browser-local profile, redirects to `/my-quote`, and pre-fills quote contact fields.
- Browser check: `/sign-in?redirect=/my-quote` has one email field, zero password fields, redirects to `/my-quote`, and preserves the existing quote cart.
- Browser check: Studio search narrows `JBL` to the JBL product, the product modal opens, selecting `One Size` enables `Add 1 item to Quote`, and the quote contains `JBL GO 4`, `White`, and `One Size`.
- Mobile browser smoke at `390x844`: `/sign-up`, `/studio`, and `/my-quote` had no horizontal overflow.
- Browser console check: no errors or warnings after the interaction smoke pass.
- GitHub PR status: PR #48 opened against `main`: https://github.com/amcleod-ps/v0-promoshop-inc-monday-apr-13/pull/48
- Merge status: not self-merged. This is production client code, so the standing human review gate remains in force.

Next.js references for dynamic streamed 404 behavior:

- https://nextjs.org/docs/app/api-reference/file-conventions/not-found
- https://nextjs.org/docs/app/guides/streaming
