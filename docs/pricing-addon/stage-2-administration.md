# Stage 2 — pricing administration and import

Status date: 2026-08-02  
Repository baseline: `4ed4dff8bca389867a2d059619170ffc280490c9` (Stage 1 merge)  
Hosted Supabase project: `rfvnjxrhainbldxtzdfb`

Stage 2 adds a protected way to validate, reconcile, replace, and explicitly
retire complete per-SKU tier sets. It does not include customer prices, change
the storefront, alter quote storage, enable either release gate, or constitute
customer acceptance.

## Authorization boundary

The existing CMS intentionally retains its historical behaviour when
`ADMIN_DASHBOARD_PASSWORD` is absent. Pricing is stricter:

1. pricing rows are not queried for the Pricing panel unless the password is
   configured and the current request presents valid Basic credentials;
2. every pricing server action repeats that strict check before parsing input
   or creating a service-role client;
3. direct browser roles cannot read pricing, state, audit, or execute mutation
   functions; and
4. an unset password always locks the Pricing panel and denies pricing actions.

The Basic username is ignored by the existing gate. Audit entries therefore
say `Authenticated admin channel`; they do not claim to identify a person.

## Matrix contract

The importer uses `pricing-matrix-template.csv` and requires the exact header:

`sku,product_name,min_order_quantity,tier_start_quantity,unit_price_usd,notes`

The parser supports a UTF-8 BOM, CRLF/LF, quoted commas/newlines, and escaped
quotes. It applies bounded file, row, field, and per-SKU tier limits before any
write. The dry run:

- reports row, field, and deterministic validation codes;
- matches case-preserved SKUs and the current reference product name;
- verifies every CSV MOQ against the live catalogue;
- requires positive PostgreSQL-int4 quantities;
- requires strictly increasing, unique starts whose first value equals MOQ;
- accepts positive USD decimals with one to four places and canonicalizes them
  to four;
- excludes notes and reference labels from the effective pricing fingerprint;
- returns no writable canonical set when any error exists; and
- computes a stable SHA-256 fingerprint over effective sorted pricing data.

Source rows for each SKU must already be strictly increasing. Rows for
different SKUs may be interleaved. Product names and notes are validation and
reference inputs only; they never update catalogue content.

## Atomic administration

Migration `0013_pricing_administration.sql` adds:

- `product_price_tier_sets`, the current per-SKU revision, status,
  fingerprint, tier count, and last-change evidence;
- `product_price_tier_audit`, append-only before/after tier snapshots and
  batch evidence; and
- `replace_product_price_tier_sets(...)`, the sole pricing mutation
  surface available to the application service role.

The function validates the entire bounded operation array, then locks all
affected product rows in deterministic SKU order. Product locks serialize two
concurrent first writes even when no state row exists yet. It then locks state
and tier rows, rechecks every expected revision and stored fingerprint, and
stages every before/after snapshot before performing a write.

Only after all operations pass does the function delete and insert complete
sets, advance revisions, and append audit rows. One PostgREST RPC call is one
database transaction; any error rolls back the complete multi-SKU batch.
Normal replacement cannot save an empty set. Removing all tiers requires an
explicit retirement operation against an active current revision.

The function is `SECURITY DEFINER` with an empty search path, no dynamic SQL,
fully qualified relations/functions, and execution granted only to
`service_role`. Stage 2 revokes the direct service-role tier DML granted
temporarily by Stage 1. All three pricing tables are read-only to the service
role outside the function, use enabled and forced RLS, have no policies, and
grant browser roles nothing.

## Reconciliation and evidence

Each successful batch returns:

- one change ID and timestamp;
- affected SKU, replacement-tier, and retirement counts;
- the resulting revision/status/fingerprint for every affected SKU; and
- a deterministic fingerprint of all current pricing states.

CSV Apply sends the exact dry-run fingerprint and the per-SKU revisions
observed during that dry run. The server reparses the original CSV from scratch.
The database checks those revisions again under locks. A changed file or
concurrent edit rejects the complete import without overwriting newer data.

The hosted migration may be installed only from the exact reviewed blob while
the feature flag is false and the tier table is empty. Synthetic integration
checks must run inside a rolled-back transaction so hosted tier, state, and
audit counts return to zero.

## Stage 2 verification record

- [x] Stage 1 merge checkpoint reconciled as the repository baseline.
- [ ] Focused parser/validation tests pass.
- [ ] Quality workflow passes on the reviewed Stage 2 head.
- [ ] Security, SQL, and code reviews have no unresolved blocking findings.
- [ ] Exact reviewed migration is applied to the hosted project.
- [ ] Hosted grants, forced RLS, policies, function security, flag, and empty
      state match the reviewed SQL.
- [ ] Rolled-back synthetic tests prove atomic replace, stale conflict, audit,
      retirement, and reactivation behaviour.
- [ ] Locked Pricing panel and unchanged public/legacy-dashboard behaviour are
      rendered and smoke-tested.
- [ ] Pull request is merged and the exact new main/deployment state is verified.

Completing this record proves Stage 2 administration readiness only. It does
not prove an approved customer matrix was received or loaded, public pricing
was enabled, Stage 3 was delivered, production was released, or the customer
accepted the add-on.
