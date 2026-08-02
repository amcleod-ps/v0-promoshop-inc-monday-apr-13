import {
  calculateSubtotalUsd,
  normalizeUnitPriceUsd,
} from "./money"
import type {
  InvalidTierReason,
  PriceTier,
  PricingCalculation,
  PricingInput,
  QuantityLine,
} from "./types"

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function invalidTiers(reason: InvalidTierReason): PricingCalculation {
  return { status: "invalid_tiers", reason }
}

/**
 * Aggregates variant-level cart lines by trimmed, case-preserved SKU. Returning
 * null is a fail-closed signal for a blank SKU, invalid quantity, or integer
 * overflow; callers must not price a partially aggregated cart.
 */
export function aggregateQuantitiesBySku(
  lines: readonly QuantityLine[],
): ReadonlyMap<string, number> | null {
  const quantities = new Map<string, number>()

  for (const line of lines) {
    if (typeof line.sku !== "string" || !isPositiveSafeInteger(line.quantity)) {
      return null
    }

    const sku = line.sku.trim()
    if (!sku) return null

    const total = (quantities.get(sku) ?? 0) + line.quantity
    if (!Number.isSafeInteger(total)) return null

    quantities.set(sku, total)
  }

  return quantities
}

/**
 * Selects the greatest tier start not exceeding quantity and calculates an
 * exact USD estimate. Tier order is validated, never silently sorted or
 * repaired. The first tier must begin at the product MOQ.
 */
export function calculateTieredPrice(
  input: PricingInput,
): PricingCalculation {
  if (!isPositiveSafeInteger(input.quantity)) {
    return { status: "invalid_input", reason: "quantity" }
  }

  if (!isPositiveSafeInteger(input.minimumQuantity)) {
    return { status: "invalid_input", reason: "minimum_quantity" }
  }

  if (input.quantity < input.minimumQuantity) {
    return {
      status: "below_moq",
      quantity: input.quantity,
      minimumQuantity: input.minimumQuantity,
    }
  }

  if (!Array.isArray(input.tiers) || input.tiers.length === 0) {
    return {
      status: "missing_tiers",
      quantity: input.quantity,
      minimumQuantity: input.minimumQuantity,
    }
  }

  const validatedTiers: Array<PriceTier> = []
  let previousStart = 0

  for (let index = 0; index < input.tiers.length; index += 1) {
    const tier = input.tiers[index]

    if (!isPositiveSafeInteger(tier.tierStartQuantity)) {
      return invalidTiers("invalid_start")
    }

    if (index === 0 && tier.tierStartQuantity !== input.minimumQuantity) {
      return invalidTiers("first_tier_must_match_moq")
    }

    if (tier.tierStartQuantity <= previousStart) {
      return invalidTiers("non_increasing_starts")
    }

    const unitPriceUsd = normalizeUnitPriceUsd(tier.unitPriceUsd)
    if (unitPriceUsd === null) {
      return invalidTiers("invalid_price")
    }

    validatedTiers.push({
      tierStartQuantity: tier.tierStartQuantity,
      unitPriceUsd,
    })
    previousStart = tier.tierStartQuantity
  }

  let selectedTier: PriceTier | undefined

  for (const tier of validatedTiers) {
    if (tier.tierStartQuantity > input.quantity) break
    selectedTier = tier
  }

  if (!selectedTier) {
    return {
      status: "missing_tiers",
      quantity: input.quantity,
      minimumQuantity: input.minimumQuantity,
    }
  }

  const subtotalUsd = calculateSubtotalUsd(
    selectedTier.unitPriceUsd,
    input.quantity,
  )

  if (subtotalUsd === null) return invalidTiers("invalid_price")

  return {
    status: "priced",
    currency: "USD",
    quantity: input.quantity,
    minimumQuantity: input.minimumQuantity,
    tierStartQuantity: selectedTier.tierStartQuantity,
    unitPriceUsd: selectedTier.unitPriceUsd,
    subtotalUsd,
  }
}
