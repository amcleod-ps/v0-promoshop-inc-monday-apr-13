import { aggregateQuantitiesBySku, calculateTieredPrice } from "./engine"
import { sumSubtotalsUsd } from "./money"
import type { PricingTierMap } from "./types"

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
      readonly unitPriceUsd: string
      readonly subtotalUsd: string
    }
  | {
      readonly status: "unpriced"
      readonly sku: string
      readonly quantity: number
    }

export interface CustomerPricingSummary {
  readonly bySku: Readonly<Record<string, CustomerSkuPricing>>
  readonly estimatedTotalUsd: string | null
  readonly hasPricedItems: boolean
  readonly hasUnpricedItems: boolean
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
    hasPricedItems: false,
    hasUnpricedItems: false,
  }

  const quantities = aggregateQuantitiesBySku(
    lines.map((line) => ({ sku: line.productSku, quantity: line.quantity })),
  )
  if (quantities === null) return empty

  const bySku: Record<string, CustomerSkuPricing> = Object.create(null)
  const subtotals: string[] = []
  let hasUnpricedItems = false

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
      bySku[sku] = {
        status: "priced",
        sku,
        quantity,
        tierStartQuantity: calculation.tierStartQuantity,
        unitPriceUsd: calculation.unitPriceUsd,
        subtotalUsd: calculation.subtotalUsd,
      }
      subtotals.push(calculation.subtotalUsd)
    } else {
      bySku[sku] = { status: "unpriced", sku, quantity }
      hasUnpricedItems = true
    }
  }

  const estimatedTotalUsd = subtotals.length > 0 ? sumSubtotalsUsd(subtotals) : null
  if (subtotals.length > 0 && estimatedTotalUsd === null) return empty

  return {
    bySku,
    estimatedTotalUsd,
    hasPricedItems: subtotals.length > 0,
    hasUnpricedItems,
  }
}
