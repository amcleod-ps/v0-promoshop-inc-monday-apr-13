# Stage 1 — pricing foundation

Status date: 2026-08-02  
Repository baseline: `942051ae656559b86a7507a231f01ea694950fd8` (Stage 0 merge)  
Hosted Supabase project: `rfvnjxrhainbldxtzdfb`

Stage 1 establishes an inactive, testable pricing model. It does not load customer prices, change the storefront, alter quote storage, enable administration, or activate pricing.

## Reconciled predecessor

The hosted project has no `supabase_migrations.schema_migrations` ledger because its migrations were applied manually. Object-level reconciliation confirmed migrations `0001` through `0010`. The previously unapplied, already-reviewed `0011_quote_id_and_product_image_order_hardening.sql` was then applied and verified on 2026-08-02:

- the new quote-default trigger exists and the superseded timestamp trigger is absent;
- `force_quote_request_insert_defaults()` is security-definer, pins `search_path=public`, and has no PUBLIC execute privilege; and
- `assign_sort_order()` contains the reviewed explicit NULL-scope comparison.

This establishes `0011` as the verified hosted predecessor for `0012_tiered_pricing.sql`. Object evidence is recorded separately from the nonexistent managed ledger.

## Technical decisions

- Currency is USD only.
- Unit prices accept one to four decimal places and are canonicalized to four decimals.
- Unit prices must be greater than zero and less than USD 100,000,000. Absence of tiers means unpriced; zero is not used as an ambiguous “missing” value.
- Subtotals use BigInt ten-thousandths and round half up once, at the complete SKU quantity, to two display decimals.
- A tier starts at the product MOQ and remains effective until the next start; the last tier has no upper bound.
- Variant lines aggregate by trimmed, case-preserved SKU before tier selection.
- Future-dated tiers are not part of the initial release.
- A SKU may become unpriced only through a deliberate Stage 2 retirement operation that atomically removes its complete tier set.
- Activation requires both controls: the database `tiered_pricing` flag and the server-only `TIERED_PRICING_ENABLED=true` environment value. Both default off.
- Stage 4’s server-owned snapshot will contain schema version, SKU, quantity, MOQ, selected tier start, canonical unit USD, rounded subtotal USD, currency, calculation timestamp, and a tier-set revision/fingerprint.
- Stage 2’s import will validate the complete file before a transaction, lock each affected product/tier set, replace complete sets atomically, and return row/SKU counts plus a deterministic reconciliation fingerprint.

## Repository implementation

- `feature_flags` stores the global, fail-closed database gate.
- `product_price_tiers` uses the natural composite key `(product_sku, tier_start_quantity)`, an exact numeric price, a product foreign key, constraints, updated-at trigger, explicit grants, and forced RLS.
- Anonymous and authenticated roles receive no privileges or policies on either pricing table. Pricing rows stay behind the server boundary even when the database flag changes.
- Service-role access is limited to flag read/toggle and tier CRUD; forced RLS remains enabled as defense in depth.
- `lib/pricing/` contains the pure engine, exact-money helper, types, and strict server flag.
- `lib/supabase/pricing.ts` is a server-only defensive read. It returns before database access unless the exact server flag is on, verifies the independent database flag through the service-role client, and only then reads tiers. A disabled gate never queries or returns tier rows, preserving the existing catalogue if the migration is absent.
- Node’s built-in test runner executes through the existing `tsx` dependency; the Quality workflow runs tests before the production build.

## Verification state

- [x] Existing `0011` predecessor applied and object-verified.
- [x] Stage 1 pull request checks completed on the reviewed implementation head.
- [x] Exact reviewed `0012` applied to the hosted project.
- [x] Hosted constraints, grants, forced RLS, absence of policies, flag state and empty tier state verified.
- [x] Stage 1 pull request merged and exact `main` head verified as `4ed4dff8bca389867a2d059619170ffc280490c9`.

The applied migration is blob `8d1b1886e09dc9e5aa2db614d9520ecf4f191371` from reviewed commit `27f30f7c1d255d6c5897db02a4cb12bc89ae3055`. A consolidated hosted query returned true for all thirteen assertions: both tables and both updated-at triggers exist; all eight constraints match; both tables have enabled and forced RLS; there are no RLS policies or public-role table/column grants; anon and authenticated cannot select or write; the service role retains `BYPASSRLS` and only the intended privileges; `tiered_pricing=false`; the tier table is empty; and the pre-existing manual-migration ledger state is unchanged.

The database flag remains false, the server environment flag is absent unless separately configured, and no customer pricing rows are included in this stage.
