# Stage 3 — customer pricing review-ready record

Status date: 2026-08-16
Repository state: hosted review database prepared; not publicly activated

This record covers the customer-facing pricing implementation prepared from
the August 7 client package. The later hosted migration, load, and
reconciliation evidence is recorded separately. Neither record proves a public
release, a sent client notice, or client acceptance.

## Implemented public rules

- Each approved USD tier set starts at one unit.
- Product and quote views label the one-unit tier as `No decoration` and
  later supplied tiers as `With decoration`, matching the source columns.
- Quantity is combined by SKU across colour and size lines before a tier is
  chosen. For example, 30 units use the 24-unit rate when the starts are 1,
  12, 24, and 48.
- A tier remains active until the next tier starts. The final tier remains
  active above its last start.
- At 48 combined units or more, the product and quote views prompt the
  customer to contact PromoShop for better large-quantity pricing while the
  estimate continues to use the supplied 48-unit rate.
- Supplier operating quantities are preserved as internal data by migration
  `0015`. They never appear as a public quantity gate.
- The storefront shows the supplied USD estimate disclosure, the supplied
  Canadian-pricing message for the identified Canadian set, and the supplied
  no-pricing message for all other SKUs without a USD tier.
- The home-page Studio explainer stays hidden until both pricing release gates
  are open, so it cannot promise an estimated total while pricing is off.
- The Studio banner describes quote selection without saying that a quote
  unlocks pricing while the release gates are closed.
- Quote confirmation copy uses the approved `2–5 business days` response
  period everywhere instead of the older `24–48 hours` wording.
- Quote submission still recalculates the price on the server. A changed
  estimate returns the customer to review instead of storing a quote against a
  price they did not see.

## Source-import control

The administrator can import either the existing strict six-column matrix or
the reviewed twelve-column, formatting-aware extraction. The extraction keeps
the meaning of offered and crossed-out source tiers that a raw workbook CSV
would lose. Its supplier-MOQ column is deliberately not copied into the
public `min_order_quantity` field.

The import remains atomic. It first normalizes and validates the complete
file, matches active catalogue products, creates a deterministic fingerprint,
and then uses the existing revision-checked database mutation. A bad row does
not write a partial price set.

The final source-to-live reconciliation found 107 active live products. All
88 priced source SKUs match the live catalogue and normalize into 349 offered
tier rows. Nineteen live products correctly have no operative USD tiers: the
14 identified Canadian products, the two deliberately unpriced USD products,
and three other catalogue products covered by the default no-pricing notice.
VEST 002 has an older worksheet title, `Stio Dawners Vest`, while the current
catalogue says `Stio Dawner™ Vest`. Because the source title is reference-only,
the exact SKU controls the import and the current catalogue title remains
unchanged.

## PUL 005 XXL+ source note

The package notes that XXL+ costs extra but does not define an amount or a
customer rule. The prepared implementation therefore imports only the
explicit base USD tiers. It does not invent a surcharge, hide the product,
make it quote-only, or add a public exception. Confirm the intended XXL+
handling with Abigail before public activation.

## Image removal

The product editor now supports removal for product-level and colour-level
gallery images. The action deletes only the `product_images` relationship. It
does not delete the original object from Supabase Storage. The confirmation
dialog states this recovery boundary before the action runs.

## Release boundary

Both pricing controls stay off: the database flag remains false and the server
environment flag remains unset. The required schema and the validated matrix
are now installed and reconciled in the hosted database. No Vercel setting was
changed, no public price was enabled, and no external message was sent.

The exact hosted evidence is in the
[hosted review-database release record](./hosted-review-database-release-2026-08-16.md).
Obtain preview acceptance before a separate activation decision. Reconfirm the
30-unit rule and the PUL 005 XXL+ handling on the next call with Abigail.
