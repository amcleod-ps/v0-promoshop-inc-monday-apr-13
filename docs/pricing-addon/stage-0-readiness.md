# Stage 0 readiness record

Status date: 2026-08-02  
Upstream repository: `amcleod-ps/v0-promoshop-inc-monday-apr-13`  
Verified upstream base: `b7336b97091c2fb045b01564424afc03834b6478`  
Stage 0 merge: `942051ae656559b86a7507a231f01ea694950fd8`

Stage 0 prepared the repository, evidence boundaries and controls without loading or activating production pricing. Its repository work completed in the merged Stage 0 pull request; unresolved client-input and hosted-release checks remain explicit gates for later data import and public release.

## Verified baseline

### Repository

- `main` resolves to the verified base commit above.
- The application is Next.js 16 / React 19 with TypeScript, pnpm and Supabase.
- `products` contains `min_qty` but no price fields or tier relation.
- Browser-local quote-cart items contain product, SKU, variant, quantity and image information, but no canonical pricing snapshot.
- Quote submission validates on the server, uses a honeypot and applies an in-memory IP throttle.
- The current public insert boundary for quote requests is not proof that a supplied estimate was calculated by the server.
- Existing administrator mutations use server-only service-role access and re-authorize each action.
- The repository exposes `lint` and production `build` scripts but had no automated test framework or GitHub Actions workflow at the verified base.

### Hosted systems

- The repository-connected Vercel deployment was ready at the verified base commit.
- The custom domains were not attached to that connected Vercel project and were serving a different deployment path.
- The apex `.com` host redirected to `www` only after bypassing a certificate-name mismatch; its certificate covered the `www` host but not the apex host.
- The repository-connected deployment returned the administration page without the optional `ADMIN_DASHBOARD_PASSWORD` gate.
- The correct hosted Supabase project, `rfvnjxrhainbldxtzdfb`, is accessible through the PromoShop Inc. organization.
- The project has no Supabase-managed migration ledger because repository migrations were applied manually.
- Object-level reconciliation confirmed migrations through `0010`; the previously missing reviewed `0011` was applied and its trigger, function security and NULL-scope ordering markers were verified on 2026-08-02.
- All twelve predecessor public tables have RLS enabled but not forced. Existing tables retain broad historical role grants; `0012` therefore revokes defaults and rebuilds least-privilege grants for its new tables explicitly.

## Repository preparation

- [x] Establish a write-capable fork and contribution path without using a local checkout.
- [x] Create `agent/pricing-addon-stage-0` from the verified upstream commit.
- [x] Add a `Quality` workflow for frozen install, lint and production build.
- [x] Add a canonical, gate-driven stage plan.
- [x] Add a clean pricing-matrix template and validation contract.
- [x] Add an acceptance-test inventory.
- [x] Confirm the quality workflow succeeds.
- [x] Open draft PR #50 to upstream and verify its complete diff and mergeability.

## Required inputs

- [ ] Complete approved SKU/tier pricing matrix.
- [ ] Approved estimate disclaimer.
- [ ] Approved message for an item with no usable price.
- [ ] Approved guidance for taxes and costs excluded from the estimate.
- [ ] Confirmation that the matrix covers every SKU expected to show pricing.

No real pricing data belongs in the repository, issue, pull request or test fixture. Production values must be handled through the approved operational import path.

## Behaviour decisions

- [ ] Quantity aggregation across variants of one SKU.
  - Provisional default: aggregate all cart lines with the same SKU.
- [ ] Below-MOQ behaviour.
  - Provisional default: show the MOQ, withhold the estimate and prevent estimated submission until corrected.
- [ ] Decimal scale and display rounding.
  - Provisional default: store exact decimal input and round only for the approved display/snapshot rule.
- [ ] Stale-price behaviour.
  - Provisional default: recalculate on submission and require review before saving when the result changed.
- [ ] Missing-price behaviour.
  - Provisional default: keep the item quoteable without inventing a price, while clearly marking the estimate incomplete.

Changing a provisional default updates this record and the acceptance matrix before implementation.

## Hosted access and operational controls

- [x] Obtain access to the correct hosted Supabase project.
- [x] Verify that no managed ledger exists and reconcile hand-applied migrations `0001` through `0011` through object evidence.
- [x] Record current RLS, policy, grant, trigger and relevant function state.
- [x] Resolve verified predecessor drift by applying and verifying the reviewed `0011` migration.
- [ ] Confirm the Vercel project that owns the production custom domains.
- [ ] Confirm preview and production environment-variable ownership.
- [x] Authorize and verify the Vercel fork-based preview for PR #50.
- [ ] Enable and verify the administration gate before pricing administration is used on a hosted environment.
- [ ] Repair and verify the apex `.com` certificate and redirect.
- [ ] Capture a pre-change smoke baseline for all production hosts and core routes.

## Stage 1 design gates

Before a pricing migration is authored:

- [x] Store one to four decimal places, canonicalize unit prices to four decimals and round final SKU subtotals half up to cents.
- [x] Require strictly positive tier prices; absence of tiers means unpriced.
- [x] Exclude future-dated tiers from the initial release.
- [x] Allow complete tier retirement only through an explicit Stage 2 atomic operation.
- [x] Require both the database flag and exact server environment value `TIERED_PRICING_ENABLED=true`; both default off.
- [x] Define the Stage 4 server snapshot fields in `stage-1-foundation.md`.
- [x] Define the Stage 2 atomic replacement and reconciliation contract in `stage-1-foundation.md`.

The exact hosted objects now establish `0011` as the predecessor. Stage 1 authors `0012_tiered_pricing.sql` without loading or activating pricing.

## Stage 0 exit criteria

The repository-preparation portion of Stage 0 is complete: its pull request is green, reviewed and merged; the hosted database is accessible and reconciled through `0011`; and the foundation design gates are resolved.

The following remain release-readiness gates carried into later stages:

1. required client inputs and final behaviour decisions are recorded;
2. the release project and environment ownership are unambiguous;
3. the hosted administration route is protected;
4. all custom-domain TLS and redirect checks pass; and
5. a reproducible pre-change production baseline is retained.

An empty, off-by-default foundation schema and isolated pricing engine may be installed and verified while those release gates remain open. Until every release-readiness gate passes, there is no customer matrix import, public activation, customer-facing pricing release or customer acceptance.
