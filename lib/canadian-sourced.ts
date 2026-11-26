import { productPricingSource } from "@/lib/pricing/source"

/**
 * "Canadian sourced" products are the CAD-priced SKUs: the Canadian rows of
 * the approved pricing workbook (CANADIAN_PRICE_SKUS in lib/pricing/source.ts).
 * On the Canadian site they get their own nav page (/canadian-sourced), a
 * Studio category, and a maple-leaf badge on each card.
 *
 * Deliberately not the team-managed "sourced from canada" tag: that tag also
 * marks USD-priced items (e.g. Victorinox) that should not carry the leaf.
 * To add or remove a product, edit CANADIAN_PRICE_SKUS.
 */
export const CANADIAN_SOURCED_CATEGORY = "Canadian Sourced"

export function isCanadianSourced(product: { sku: string; tags?: readonly string[] }): boolean {
  return productPricingSource(product) === "CAN"
}
