import { normalizeUnitPriceUsd } from "./money"
import type { PricingTierMap } from "./types"

export type ProductSortOrder = "recommended" | "price-asc"

/** Use the price for the smallest listed quantity, in its source currency. */
export function catalogStartingPrice(sku: string, tiersBySku: PricingTierMap): string | null {
  const tier = tiersBySku[sku]?.[0]
  if (!tier || !Number.isSafeInteger(tier.tierStartQuantity) || tier.tierStartQuantity <= 0) return null
  return normalizeUnitPriceUsd(tier.unitPriceUsd)
}

/** Keep equal prices and products without prices in their previous order. */
export function sortProductsByPrice<T extends { sku: string }>(
  products: readonly T[],
  tiersBySku: PricingTierMap,
): T[] {
  return products
    .map((product, index) => {
      const price = catalogStartingPrice(product.sku, tiersBySku)
      return { product, index, amount: price === null ? null : BigInt(price.replace(".", "")) }
    })
    .sort((a, b) => {
      if (a.amount === null) return b.amount === null ? a.index - b.index : 1
      if (b.amount === null) return -1
      return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : a.index - b.index
    })
    .map(({ product }) => product)
}
