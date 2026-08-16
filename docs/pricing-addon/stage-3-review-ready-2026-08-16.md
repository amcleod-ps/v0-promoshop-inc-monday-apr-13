# Stage 3 — customer pricing review-ready record

Status date: 2026-08-16
Repository state: prepared for review; not deployed or activated

This record covers the customer-facing pricing implementation prepared from
the August 7 client package. It does not prove a hosted migration, a price-data
load, a public release, a sent client notice, or client acceptance.

## Implemented public rules

- Each approved USD tier set starts at one unit.
- Quantity is combined by SKU across colour and size lines before a tier is
  chosen. For example, 30 units use the 24-unit rate when the starts are 1,
  12, 24, and 48.
- A tier remains active until the next tier starts. The final tier remains
  active above its last start.
- Supplier operating quantities are preserved as internal data by migration
  `0015`. They never appear as a public quantity gate.
- The storefront shows the supplied USD estimate disclosure, the supplied
  Canadian-pricing message for the identified Canadian set, and the supplied
  no-pricing message for all other SKUs without a USD tier.
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

Both pricing controls stay off: the database flag remains false and the
server environment flag remains unset. No migration was applied, no client
price was imported, no Vercel deployment was changed, and no external message
was sent by this work.

Before a controlled release, reconcile the hosted migration state; apply and
verify `0015` before the first tier import; dry-run the reviewed source; load
the validated matrix while both gates remain off; obtain preview acceptance;
then make a separate activation decision. Reconfirm the 30-unit rule and the
PUL 005 XXL+ handling on the next call with Abigail.
