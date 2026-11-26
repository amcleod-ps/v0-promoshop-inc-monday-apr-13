/**
 * "Canadian sourced" products are the ones the team tags `sourced from canada`
 * (Admin → Products → tags). On the Canadian site they get their own nav page
 * (/canadian-sourced), a Studio category, and a maple-leaf badge on each card.
 */
export const CANADIAN_SOURCED_TAG = "sourced from canada"

/** Studio category value for the Canadian-sourced view. */
export const CANADIAN_SOURCED_CATEGORY = "Canadian Sourced"

export function isCanadianSourced(product: { tags?: readonly string[] }): boolean {
  return (product.tags ?? []).includes(CANADIAN_SOURCED_TAG)
}
