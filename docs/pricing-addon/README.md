# Tiered-pricing add-on

This folder is the canonical technical plan for adding quantity-based USD estimates to the existing quote-first storefront. It deliberately contains no customer price data, contract terms, personal information, credentials, or production secrets.

## Delivery outcome

For a product with an approved pricing matrix, the storefront will:

- respect the product minimum order quantity (MOQ);
- select the correct per-SKU unit price for the requested quantity;
- show the current unit price and estimated subtotal in USD;
- preserve continuous tiers by treating each tier start as effective until the next tier starts;
- allow authorized administrators to maintain tiers and import the initial matrix;
- recalculate pricing on the server when a quote is submitted; and
- preserve a structured pricing snapshot with the quote for later review.

## Initial-release boundaries

Included:

- per-SKU quantity tiers;
- USD source prices;
- MOQ-aware estimates;
- administrator editing and one validated matrix import;
- storefront estimate display; and
- quote-request pricing evidence.

Not included:

- CAD conversion;
- checkout, payment capture, order fulfilment or inventory reservation;
- tax, shipping, decoration or other fee calculation unless later supplied as explicit pricing inputs;
- retroactive pricing of historical quote requests; or
- public activation before the release gates are satisfied.

An estimate must remain clearly identified as an estimate. The add-on must not imply that a quote request is an order or that a displayed amount is a final invoice.

## Engineering principles

1. **Server authority.** Browser calculations improve the experience; the server performs the authoritative calculation from current persisted tiers.
2. **Exact money handling.** Persist prices as PostgreSQL `NUMERIC`, never binary floating point. The final scale and rounding rule must be approved before the migration is authored.
3. **Least privilege.** Public clients may read only the pricing data required to calculate an estimate. Writes remain server-side and administrator-authorized. Database grants and RLS policies are explicit in the same migration.
4. **Safe activation.** New schema and code deploy with the pricing feature disabled. Data is loaded and reconciled before activation.
5. **Atomic administration.** A product's tier set is validated and replaced as one operation; partial imports or half-written tier sets are not acceptable.
6. **Backward compatibility.** Existing browser-local quote carts without pricing fields continue to load and are recalculated from current data.
7. **Evidence boundaries.** A green build, deployed schema, loaded matrix, enabled feature and customer acceptance are separate states.

## Flexible development stages

### Stage 0 — readiness and controls

Establish the reproducible baseline, automated quality gate, input contract, acceptance tests, hosted-system visibility, environment protection and release ownership.

Exit only when the checks in [`stage-0-readiness.md`](./stage-0-readiness.md) are satisfied.

### Stage 1 — pricing model and engine

- Add a normalized tier table linked to `products`.
- Enforce positive quantities, non-negative exact prices and one unique start quantity per product.
- Add explicit grants and RLS policies.
- Implement a pure deterministic tier-selection and subtotal calculator.
- Add focused automated tests for tier boundaries, precision and invalid inputs.
- Add a release flag that defaults off.

Exit when the migration is reviewable, the calculator is fully tested and no pricing is publicly active.

### Stage 2 — administration and import

- Add administrator-authorized tier viewing and editing.
- Replace a SKU's complete tier set atomically.
- Add a dry-run matrix parser with row-level diagnostics.
- Import only after every row validates; reject the whole file on error.
- Record who changed tiers and when through existing audit conventions or a scoped audit addition.

Exit when an authorized administrator can safely load and reconcile synthetic data without partial writes.

### Stage 3 — customer experience

- Resolve requested quantity using the approved SKU/variant aggregation rule.
- Show MOQ, applicable tier, USD unit price and estimated subtotal.
- Apply the approved below-MOQ and missing-price messages.
- Keep the quote-first call to action and existing navigation intact.
- Migrate legacy local-storage cart entries defensively.

Exit when all supported catalogue and cart paths behave correctly on mobile and desktop with synthetic tiers.

### Stage 4 — verified quote snapshot

- Ignore any client-supplied claim that an estimate is authoritative.
- Re-read products and tiers on the server at submission time.
- Detect changed or missing tiers and return a reviewable result.
- Store a structured pricing snapshot alongside the human-readable request.
- Keep notifications consistent with the stored server result.

Exit when tampering and stale-price tests prove that stored estimates always come from the server.

### Stage 5 — preview and acceptance

- Run automated, build, browser, responsive, accessibility, security and regression checks.
- Exercise the acceptance matrix with synthetic data.
- Review a preview deployment without production customer pricing.
- Record each accepted, corrected or deferred outcome.

Exit when required checks are green and review feedback is resolved or explicitly deferred.

### Stage 6 — controlled release and handoff

- Apply and verify the exact hosted migration before loading data.
- Reconcile the complete approved matrix while the feature remains off.
- Deploy an exact reviewed commit.
- Smoke-test every custom host, redirect, TLS certificate, catalogue path, cart path, quote path and protected administration route.
- Enable the pricing flag only after the preceding checks pass.
- Monitor submissions and errors, retain a rollback path, and record acceptance separately.

Exit when production behaviour is verified and operational handoff is complete.

## Input contract

The initial matrix uses [`pricing-matrix-template.csv`](./pricing-matrix-template.csv). Each row represents one tier start. A tier remains effective until the next start quantity for that SKU; the final tier has no upper bound.

Required validation:

- `sku` matches one existing product exactly after documented normalization;
- `min_order_quantity` is a positive integer and is consistent for every row of a SKU;
- `tier_start_quantity` is a positive integer, is at least the MOQ and is strictly increasing within a SKU;
- the first tier starts at the MOQ unless an approved exception is recorded;
- `unit_price_usd` is a non-negative decimal using the approved precision;
- `product_name` and `notes` are reference-only fields and never update catalogue content;
- duplicate SKU/start pairs are rejected;
- blank or malformed required values are rejected; and
- the import reports every error before it writes anything.

## Provisional decisions

These defaults support implementation planning but are not final customer rules:

- aggregate quantities across variants of the same SKU;
- below-MOQ items remain unpriced and cannot produce an estimate;
- recalculate all pricing at quote submission; and
- require review when the server result differs from the last browser display.

Final decisions belong in the Stage 0 readiness record before Stage 1 implementation begins.

## Verification

The test inventory is maintained in [`acceptance-test-matrix.md`](./acceptance-test-matrix.md). Pull requests must pass the repository `Quality` workflow, which performs a frozen dependency install, lint and production build. Stage-specific automated tests are added as implementation begins.
