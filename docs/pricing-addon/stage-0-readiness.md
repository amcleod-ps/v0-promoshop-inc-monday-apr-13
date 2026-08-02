# Stage 0 readiness record

Status date: 2026-08-02  
Upstream repository: `amcleod-ps/v0-promoshop-inc-monday-apr-13`  
Verified upstream base: `b7336b97091c2fb045b01564424afc03834b6478`

Stage 0 prepares the pricing add-on without implementing, migrating, loading or activating production pricing.

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
- The hosted Supabase project referenced by this application was not available through the connected Supabase account.
- Consequently, the live migration ledger and exact table, policy, grant and function state are unverified. Repository migrations `0009` through `0011` must not be assumed applied solely because they exist in Git.

## Repository preparation

- [x] Establish a write-capable fork and contribution path without using a local checkout.
- [x] Create `agent/pricing-addon-stage-0` from the verified upstream commit.
- [x] Add a `Quality` workflow for frozen install, lint and production build.
- [x] Add a canonical, gate-driven stage plan.
- [x] Add a clean pricing-matrix template and validation contract.
- [x] Add an acceptance-test inventory.
- [ ] Confirm the quality workflow succeeds.
- [ ] Open the draft Stage 0 pull request to upstream and verify its complete diff/check state.

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

- [ ] Obtain access to the correct hosted Supabase project.
- [ ] Verify the hosted migration ledger against repository migrations `0001` through `0011`.
- [ ] Record exact current RLS, policy, grant, trigger and relevant function state.
- [ ] Resolve any verified migration drift before authoring the pricing migration.
- [ ] Confirm the Vercel project that owns the production custom domains.
- [ ] Confirm preview and production environment-variable ownership.
- [ ] Enable and verify the administration gate before pricing administration is used on a hosted environment.
- [ ] Repair and verify the apex `.com` certificate and redirect.
- [ ] Capture a pre-change smoke baseline for all production hosts and core routes.

## Stage 1 design gates

Before a pricing migration is authored:

- [ ] Choose the exact decimal scale and rounding rule.
- [ ] Confirm whether tier prices may be zero.
- [ ] Confirm whether future-dated tiers are required in the initial release.
- [ ] Confirm deletion/retirement semantics for a SKU's tiers.
- [ ] Confirm the feature-flag owner and activation path.
- [ ] Define the server-owned quote snapshot shape.
- [ ] Define the atomic import transaction and reconciliation output.

The anticipated next migration name is `0012_tiered_pricing.sql`, but it must not be created until the hosted ledger confirms that `0011` is the true predecessor.

## Stage 0 exit criteria

Stage 0 completes only when:

1. the Stage 0 pull request is green and reviewed;
2. required inputs and behaviour decisions are recorded;
3. the correct hosted database is accessible and reconciled;
4. the release project and environment ownership are unambiguous;
5. the hosted administration route is protected;
6. all custom-domain TLS and redirect checks pass; and
7. a reproducible pre-change baseline is retained.

Until every exit criterion passes, there is no production pricing migration, matrix import, public activation, release or customer acceptance.
