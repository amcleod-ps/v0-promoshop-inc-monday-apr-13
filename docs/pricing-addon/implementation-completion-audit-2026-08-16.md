# Pricing add-on implementation completion audit

Status date: 2026-08-16

This record separates the completed software work from the controlled hosted
release. It contains no client price values, credentials, or private account
data.

## Completed software work

- The approved source format normalizes into the protected six-column import
  format without using supplier MOQ as a public quantity limit.
- An exact, case-preserved SKU is the import identity. A reference worksheet
  title cannot rename a live product or block an otherwise exact SKU match.
- Quantities combine by SKU across colour and size lines. A quantity between
  breaks uses the last break reached.
- The one-unit price is labelled `No decoration`. Later supplied tiers are
  labelled `With decoration`.
- A quantity of 48 or more uses the supplied 48-unit rate and displays the
  large-quantity contact prompt.
- PUL 005 keeps its explicit base tiers. No XXL+ surcharge or restriction is
  invented.
- Product-gallery removal detaches the image relationship and keeps the
  original Storage object available for recovery.
- Pricing-specific home copy is visible only after both release gates open.
  The quote flow uses the approved `2–5 business days` response period.
- Customer prices remain off by default. Quote submission recalculates the
  estimate from server-read catalogue and tier data.

## Source and catalogue reconciliation

A fresh dry run used the August 7 reviewed extraction and the public Studio
catalogue on August 16:

- 107 active live catalogue products;
- 88 source SKU sets;
- 349 normalized offered tier rows;
- 19 live products without an operative USD tier; and
- zero validation diagnostics.

The 19 unpriced products are the 14 identified Canadian products, two
deliberately unpriced USD products, and three other catalogue products covered
by the default no-pricing notice.

## Verification completed

- 57 focused pricing, quote-snapshot, migration-contract, and image-removal
  tests passed.
- Lint passed.
- All 15 migrations applied in the isolated PostgreSQL-compatible check and
  every schema invariant passed.
- The production build passed.
- The production dependency audit found no known vulnerability.
- Browser checks confirmed that pricing remains hidden while the gates are
  closed, the home pricing explainer is also hidden, the quote page shows the
  approved response period, the product dialog works without the old minimum
  wording, and the mobile Studio page has no horizontal overflow.

## Hosted database preparation completed

The controlled hosted preparation now has evidence:

- The project has no managed migration ledger, consistent with its documented
  manual process. Object checks confirmed the predecessor state.
- Migrations `0014` and `0015` were applied together and verified.
- The authenticated hosted dry run passed for all 88 SKU sets and 349 rows.
- One protected atomic change loaded and reconciled the complete matrix.
- Both pricing gates stayed off, and fresh public checks showed no prices.
- Two additional migrations removed broad trigger-function execution and added
  the missing collection-membership foreign-key index.

Full counts, hashes, advisor results, and the public smoke evidence are in the
[hosted review-database release record](./hosted-review-database-release-2026-08-16.md).

## Preview and activation work still required

The software and hosted review database are complete. The full operational
release is not complete until these separate steps have evidence:

1. Complete Abigail's protected preview review and record activation approval.
2. Open both pricing gates in a separate controlled activation.
3. Verify representative priced, Canadian, unpriced, 30-unit, 48-unit, and
   mixed-cart paths on every production host.
4. Submit a controlled production quote and verify its stored server snapshot
   and notification.
5. Record Abigail's acceptance separately.

Reconfirm the 30-unit rule and PUL 005 XXL+ treatment with Abigail on the next
call. These confirmations do not change the implemented safe defaults.
