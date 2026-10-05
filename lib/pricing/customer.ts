import { aggregateQuantitiesBySku, calculateTieredPrice } from "./engine"
import { sumSubtotalsUsd } from "./money"
import { LARGE_QUANTITY_START } from "./presentation"
import type { PricingTierMap } from "./types"
import { productPriceCurrency, type PricingCurrency, type PricingTotals } from "./source"

export interface CustomerPricingLine {
  readonly productSku: string
  readonly quantity: number
}

export type CustomerSkuPricing =
  | {
      readonly status: "priced"
      readonly sku: string
      readonly quantity: number
      readonly tierStartQuantity: number
      readonly currency: PricingCurrency
      readonly unitPrice: string
      readonly subtotal: string
      readonly unitPriceUsd: string | null
      readonly subtotalUsd: string | null
    }
  | {
      readonly status: "unpriced"
      readonly sku: string
      readonly quantity: number
    }

export interface CustomerPricingSummary {
  readonly bySku: Readonly<Record<string, CustomerSkuPricing>>
  readonly estimatedTotalUsd: string | null
  readonly estimatedTotalsByCurrency: PricingTotals
  readonly hasPricedItems: boolean
  readonly hasUnpricedItems: boolean
  readonly hasLargeQuantityItems: boolean
}

/**
 * Builds the browser display from the same exact tier engine used by the
 * server snapshot. The SKU is the pricing unit: colour and size lines are
 * combined before one tier and one rounded subtotal are selected.
 */
export function buildCustomerPricingSummary(
  lines: readonly CustomerPricingLine[],
  tiersBySku: PricingTierMap,
): CustomerPricingSummary {
  const empty: CustomerPricingSummary = {
    bySku: {},
    estimatedTotalUsd: null,
    estimatedTotalsByCurrency: {},
    hasPricedItems: false,
    hasUnpricedItems: false,
    hasLargeQuantityItems: false,
  }

  const quantities = aggregateQuantitiesBySku(
    lines.map((line) => ({ sku: line.productSku, quantity: line.quantity })),
  )
  if (quantities === null) return empty

  const bySku: Record<string, CustomerSkuPricing> = Object.create(null)
  const subtotals: Record<PricingCurrency, string[]> = { CAD: [], USD: [] }
  let hasUnpricedItems = false
  let hasLargeQuantityItems = false

  for (const [sku, quantity] of quantities) {
    const tiers = tiersBySku[sku] ?? []
    const firstTier = tiers[0]
    const calculation = firstTier
      ? calculateTieredPrice({
          quantity,
          minimumQuantity: firstTier.tierStartQuantity,
          tiers,
        })
      : null

    if (calculation?.status === "priced") {
      const currency = productPriceCurrency(sku)
      bySku[sku] = {
        status: "priced",
        sku,
        quantity,
        tierStartQuantity: calculation.tierStartQuantity,
        currency,
        unitPrice: calculation.unitPriceUsd,
        subtotal: calculation.subtotalUsd,
        unitPriceUsd: currency === "USD" ? calculation.unitPriceUsd : null,
        subtotalUsd: currency === "USD" ? calculation.subtotalUsd : null,
      }
      subtotals[currency].push(calculation.subtotalUsd)
      if (quantity >= LARGE_QUANTITY_START) hasLargeQuantityItems = true
    } else {
      bySku[sku] = { status: "unpriced", sku, quantity }
      hasUnpricedItems = true
    }
  }

  const estimatedTotalsByCurrency: PricingTotals = {}
  for (const currency of ["CAD", "USD"] as const) {
    if (subtotals[currency].length === 0) continue
    const total = sumSubtotalsUsd(subtotals[currency])
    if (total === null) return empty
    estimatedTotalsByCurrency[currency] = total
  }

  return {
    bySku,
    estimatedTotalUsd: estimatedTotalsByCurrency.USD ?? null,
    estimatedTotalsByCurrency,
    hasPricedItems: Object.keys(estimatedTotalsByCurrency).length > 0,
    hasUnpricedItems,
    hasLargeQuantityItems,
  }
}
