# Hosted review-database release

Status date: 2026-08-16
Hosted project: `rfvnjxrhainbldxtzdfb`
Public pricing: disabled

This record proves that the production database is ready for a protected
client review. It contains no customer price values, credentials, or private
account data. It does not prove public activation or customer acceptance.

## Controlled application

The hosted project has no Supabase-managed migration ledger because its
repository migrations were applied manually. Object-level checks were used,
as required by the existing release records.

- Migrations `0014` and `0015` were applied together in one outer transaction.
  The exact combined SQL was 4,768 bytes with SHA-256
  `23b6260634d6bd4f121cf9ddd203d690927659719a99ef8da9874ff2239b9d07`.
- The pre-application catalogue had 134 products and 107 active products. The
  supplier-quantity checksum was
  `28984d15d072bba02838834d16d95acc`.
- The post-application catalogue kept the same product rows and supplier
  checksum. Every public pricing start is one, and every preserved supplier
  quantity is positive.
- The approved extraction produced 88 complete SKU operations and 349 tier
  rows. Its source fingerprint is
  `bab09750ef6e8406854744f4a5b9f9e3ab447933b6695dec224f963f5d7fdbf4`.
- The exact operation payload SHA-256 is
  `19ce4f2f28efcb0cea9e8d2aa808c636e3b11ec73c9b6c118bf292dea21795c4`.
  The authenticated no-write validation found zero missing, inactive,
  revision, minimum, or first-tier conflicts.
- The protected replacement function applied one atomic change with ID
  `1f2c8cf7-6dbe-4fdd-84dc-921d984e955b`. It wrote 88 active tier sets, 349
  tier rows, and 88 audit rows, with no retirements.
- The resulting reconciliation fingerprint is
  `43012e13954cc964348dd4c710498e786959ab83f2fb45cb01922f870ed75464`.

Independent source-to-table comparison found zero tier or state differences.
Every set is at revision 1. The audit rows share one change ID and timestamp.
Nineteen active products remain intentionally unpriced. The PUL 005, ACC 006,
and TOP 104 start quantities match the reviewed exception rules.

## Additional hosted hardening

The final Supabase review found older direct execution grants on three trigger
functions and one collection foreign key without a product-side index.

- Migration `0016_trigger_function_security_hardening.sql` pins an empty search
  path on the three trigger functions and removes direct API-role execution.
  The exact applied file SHA-256 is
  `70569a6085ea27a8bc3b809f4edf55df207f1e2bfb880770f50da051147ffd04`.
- A rolled-back hosted probe proved that normal service-role inserts and
  updates still run the protected ordering and timestamp triggers. No probe
  row remained.
- A separate rolled-back hosted insert under the anonymous role proved that
  the protected quote-default trigger still supplies the required identifier
  and timestamps. A follow-up query confirmed that zero probe rows remained.
- Migration `0017_collection_product_foreign_key_index.sql` adds the missing
  `collection_products.product_sku` index. The exact applied file SHA-256 is
  `cffb171d960028e3a87a417c16ffd313401da6e8cca08dd839dfadf8db753abc`.

A release-focused security scan reviewed both migrations and the SQL contract
checks. It completed with full stated coverage and no findings.

After both changes, the Security Advisor reported zero errors and one accepted
warning: the public `site-images` bucket allows listing. That bucket contains
public website assets by design. The four information items are the intended
fail-closed pricing tables with forced RLS and no policies. The Performance
Advisor reported zero errors and zero warnings. Its remaining information
items say that five indexes have not yet been used; low observed use is not
evidence that those indexes should be removed.

## Public verification and release boundary

Fresh production checks found:

- 107 Studio products;
- no price table, unit price, subtotal, or pricing-specific home section while
  the gates are closed;
- the approved `2–5 business days` quote response period; and
- no browser console messages on the checked public paths.

The database `tiered_pricing` flag remains false. No Vercel environment value
was changed. No controlled quote was submitted, and no client message was
sent.

The remaining sequence is client and activation work: protected preview
review, Abigail's activation approval, opening both gates, full representative
production checks, one controlled quote with stored snapshot and notification
evidence, and separate acceptance.
