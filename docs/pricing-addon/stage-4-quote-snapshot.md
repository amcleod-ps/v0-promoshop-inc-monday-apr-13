# Stage 4 — verified quote pricing snapshot

Status date: 2026-08-06
Repository baseline: `53ba8a604b0ce0d08ffa56366f117b52846db390` (Stage 2 merge)
Migration added: `0014_quote_pricing_snapshot.sql`

Stage 4 makes the server the only author of a priced estimate. When a quote is
submitted, the cart is repriced from current database state, the result is
stored with the request, and the staff notification reports the same figures.

It does not add customer-facing pricing, load any prices, or change either
release gate. Stage 3 remains outstanding and is blocked on client inputs, so
with the gates off this stage changes no visitor-visible behaviour at all.

## Why the browser cannot forge an estimate

Three independent mechanisms, in the order they take effect:

1. **The input has nowhere to put a price.** `submitQuoteRequest` accepts, per
   line, only `sku`, `productName`, `colour`, `size` and `quantity`. There is
   no unit-price, tier or subtotal field in the schema, so a tampered cart can
   change what is being asked for but never what it costs. This is a shape
   guarantee, not a validation rule that could be bypassed.
2. **The database refuses the column to browser roles.** Migration 0014
   rewrites the 0001 public-insert policy to pin `pricing_snapshot` to `NULL`
   for `anon` and `authenticated`. Neither role is `BYPASSRLS`, so a caller
   holding the publishable anon key — which is to say anyone who reads the
   site's JavaScript — cannot satisfy the policy while supplying a snapshot.
   The site writes the verified value through the service role, which bypasses
   RLS.
3. **The stored figure is recalculated, never echoed.** Product names, minimum
   order quantities and tiers are read server-side at submission time. The
   client's own displayed total is used for one purpose only: detecting that
   the price moved underneath the customer.

`scripts/check-sql.mjs` proves point 2 behaviourally rather than by reading
policy text: it applies all fourteen migrations to a real PostgreSQL engine,
switches to the `anon` role, and asserts that an insert carrying a snapshot is
rejected while an ordinary quote still succeeds.

## What is recorded

The SKU is the unit of account, not the cart line. Tiers are selected on the
quantity aggregated across a SKU's colour and size variants, and money is
rounded once at that level, so the variants are nested underneath rather than
listed alongside. That removes any question of which figure is authoritative
and guarantees the quote total equals the sum of the SKU figures shown.

```
version, currency, calculatedAt
skus[]
  sku, productName, status, aggregatedQuantity, minimumQuantity,
  tierStartQuantity, unitPriceUsd, subtotalUsd,
  lines[] { colour, size, quantity }
pricedSkuCount, unpricedSkuCount, estimatedTotalUsd
```

`status` is one of `priced`, `below_moq`, `no_tiers`, `unknown_sku`,
`inactive_sku` or `invalid_tiers`. Unpriced SKUs are recorded with their reason
rather than dropped: a stored quote that silently omits an item the customer
asked about is how a request gets answered incompletely. `estimatedTotalUsd` is
`null` when nothing priced, so an empty estimate is never presented as `0.00`.

Money is exact throughout. Unit prices are parsed as scaled `BigInt`
ten-thousandths, each SKU subtotal is rounded half-up to cents exactly once,
and totals are summed as integer cents. `Number` is never used for a monetary
value at any stage — a cart bounded at 200 lines of up to 1,000,000 units with
unit prices approaching 100,000,000 can produce a subtotal above 2^53 cents,
where floating-point addition silently returns a neighbouring value.

## Review instead of a silent correction

If the total the browser last displayed does not match what the server just
calculated, the submission returns `status: "review_required"` with the current
snapshot and **is not stored**. A tier was edited, a product was retired, or
the cart was altered; recording the request against an amount nobody agreed to
would be worse than asking the customer to look again. An absent or
unparseable client figure counts as a mismatch, because "no evidence the
customer saw this total" is not agreement. A cart in which nothing could be
priced is never held for review, as there is no estimate to disagree about.

Supplying the approved customer-facing wording for that state belongs to
Stage 3. The action deliberately returns no prose, so the existing generic
message in `/my-quote` is what a visitor would see today.

## Failure behaviour

An unpriced quote request is the product's existing, working behaviour, so no
pricing problem may turn into a lost enquiry. The submission falls back to the
original anon-client path, storing the request without a snapshot and logging
the reason, when: either release gate is closed; the cart carried no items; the
pricing context cannot be read; the cart is malformed; or
`SUPABASE_SERVICE_ROLE_KEY` is missing or invalid.

The public quote form therefore gains no new dependency on the service-role
key. Only the snapshot does.

## Verification

| Check | Result |
|---|---|
| `pnpm lint` | clean |
| `pnpm test` | 49 tests pass |
| `pnpm check:sql` | 14 migrations applied to real PostgreSQL, invariants hold |
| `pnpm build` | production build succeeds |

`pnpm check:sql` is new in this stage and is wired into the `Quality`
workflow. Nothing else in the pipeline executed the SQL: lint and the build
never parse a migration, so a syntax error, an impossible constraint or a
privilege mistake would previously have reached the client's database
unchallenged. It runs PGlite — PostgreSQL compiled to WebAssembly — creates the
Supabase roles and a minimal Storage stub, applies every migration in order,
then asserts forced RLS on the pricing tables, no browser-role privileges on
them, the snapshot column type and object constraint, and the anon-forgery
behaviour above. Its one deliberate deviation from production SQL is
neutralising `CREATE EXTENSION pgcrypto`, which PGlite does not ship; the
migrations use it only for `gen_random_uuid()`, part of core PostgreSQL since
version 13.

### Mutation testing

Each check was confirmed to fail when the behaviour it guards is broken:

| Mutant | Caught by |
|---|---|
| Public insert policy no longer pins `pricing_snapshot` | `check:sql` policy assertion **and** the anon-forgery test |
| Snapshot `CHECK` weakened to accept any JSON | `check:sql` non-object rejection |
| Tier selected on the line quantity instead of the SKU aggregate | aggregation test |
| Cart-supplied product name overrides the catalogue | catalogue-name test |
| Minimum order quantity floor removed | 7 tests |
| Totals summed through `Number` instead of `BigInt` | float-safe range test |

The float mutant initially survived and the missing case was added, which is
the reason the large-value test exists.

## Not included

- Customer-facing price display (Stage 3, blocked on the approved matrix and
  the three approved wordings).
- Retroactive pricing of historical quote requests.
- Any change to release gates, which remain off.
- Dashboard presentation of the stored snapshot.
