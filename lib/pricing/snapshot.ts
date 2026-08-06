import { calculateTieredPrice, aggregateQuantitiesBySku } from "./engine"
import { sumSubtotalsUsd } from "./money"
import type {
  PricingTierMap,
  QuoteLineInput,
  QuotePricingSnapshot,
  QuoteSnapshotResult,
  SnapshotProduct,
  SnapshotSku,
  SnapshotSkuStatus,
  SnapshotVariantLine,
} from "./types"

/**
 * Bounded so one submission cannot force unbounded work or an unreadable
 * record. The server action rejects larger carts before reaching here; this is
 * the second, independent limit.
 */
export const MAX_SNAPSHOT_LINES = 200

function trimmedOrNull(value: string | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/**
 * Builds the pricing evidence stored with a quote request.
 *
 * Pure and deterministic: every catalogue and pricing fact arrives as an
 * argument, including the timestamp, so the same inputs always produce the
 * same record and the whole thing is testable without a database.
 *
 * The browser's cart supplies only SKUs, variants and quantities. Product
 * names, minimum order quantities and prices come from `products` and `tiers`,
 * which the caller reads server-side, so a tampered cart can change what is
 * being asked for but never what it costs.
 *
 * Unpriced SKUs are recorded with a reason rather than dropped. A quote that
 * silently omits an item the customer asked for is worse than one that says it
 * could not be priced.
 */
export function buildQuotePricingSnapshot(
  lines: readonly QuoteLineInput[],
  products: ReadonlyMap<string, SnapshotProduct>,
  tiers: PricingTierMap,
  calculatedAt: string,
): QuoteSnapshotResult {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { status: "failed", reason: "no_lines" }
  }

  if (lines.length > MAX_SNAPSHOT_LINES) {
    return { status: "failed", reason: "too_many_lines" }
  }

  for (const line of lines) {
    if (
      typeof line?.sku !== "string" ||
      line.sku.trim() === "" ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0
    ) {
      return { status: "failed", reason: "invalid_line" }
    }
  }

  const aggregated = aggregateQuantitiesBySku(
    lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
  )

  if (aggregated === null) {
    return { status: "failed", reason: "aggregation_failed" }
  }

  const variantsBySku = new Map<string, SnapshotVariantLine[]>()
  const requestedNameBySku = new Map<string, string | null>()

  for (const line of lines) {
    const sku = line.sku.trim()
    const variants = variantsBySku.get(sku)
    const variant: SnapshotVariantLine = {
      colour: trimmedOrNull(line.colour),
      size: trimmedOrNull(line.size),
      quantity: line.quantity,
    }

    if (variants) {
      variants.push(variant)
    } else {
      variantsBySku.set(sku, [variant])
      requestedNameBySku.set(sku, trimmedOrNull(line.productName))
    }
  }

  const snapshotSkus: SnapshotSku[] = []
  const pricedSubtotals: string[] = []

  // Sorted so the stored record is stable regardless of the order the
  // customer happened to add items to the cart.
  for (const sku of [...aggregated.keys()].sort()) {
    const aggregatedQuantity = aggregated.get(sku) as number
    const variantLines = variantsBySku.get(sku) ?? []
    const product = products.get(sku)

    let status: SnapshotSkuStatus
    let tierStartQuantity: number | null = null
    let unitPriceUsd: string | null = null
    let subtotalUsd: string | null = null

    if (!product) {
      status = "unknown_sku"
    } else if (!product.isActive) {
      status = "inactive_sku"
    } else {
      const calculation = calculateTieredPrice({
        quantity: aggregatedQuantity,
        minimumQuantity: product.minimumQuantity,
        tiers: tiers[sku] ?? [],
      })

      switch (calculation.status) {
        case "priced":
          status = "priced"
          tierStartQuantity = calculation.tierStartQuantity
          unitPriceUsd = calculation.unitPriceUsd
          subtotalUsd = calculation.subtotalUsd
          pricedSubtotals.push(calculation.subtotalUsd)
          break
        case "below_moq":
          status = "below_moq"
          break
        case "missing_tiers":
          status = "no_tiers"
          break
        default:
          // invalid_input and invalid_tiers both mean the stored data cannot
          // be trusted for this SKU. Fail closed to unpriced rather than
          // guessing a price from a partially valid tier set.
          status = "invalid_tiers"
          break
      }
    }

    snapshotSkus.push({
      sku,
      productName: product?.name ?? requestedNameBySku.get(sku) ?? null,
      status,
      aggregatedQuantity,
      minimumQuantity: product?.minimumQuantity ?? null,
      tierStartQuantity,
      unitPriceUsd,
      subtotalUsd,
      lines: variantLines,
    })
  }

  const pricedSkuCount = pricedSubtotals.length
  let estimatedTotalUsd: string | null = null

  if (pricedSkuCount > 0) {
    estimatedTotalUsd = sumSubtotalsUsd(pricedSubtotals)
    if (estimatedTotalUsd === null) {
      return { status: "failed", reason: "total_arithmetic_failed" }
    }
  }

  const snapshot: QuotePricingSnapshot = {
    version: 1,
    currency: "USD",
    calculatedAt,
    skus: snapshotSkus,
    pricedSkuCount,
    unpricedSkuCount: snapshotSkus.length - pricedSkuCount,
    estimatedTotalUsd,
  }

  return { status: "built", snapshot }
}

/**
 * Compares the total the browser last displayed against the total the server
 * just calculated.
 *
 * A mismatch means the customer is looking at a price the catalogue no longer
 * offers — a tier was edited, a product retired, or the cart was altered — so
 * the submission must be sent back for review instead of being recorded
 * against an amount nobody agreed to. An absent or unparseable client figure
 * counts as a mismatch, because "no evidence the customer saw this total" is
 * not the same as agreement.
 */
export function displayedTotalMatches(
  snapshot: QuotePricingSnapshot,
  displayedTotalUsd: string | undefined,
): boolean {
  if (typeof displayedTotalUsd !== "string") return false

  const normalizedDisplayed = sumSubtotalsUsd([displayedTotalUsd.trim()])
  if (normalizedDisplayed === null) return false

  return normalizedDisplayed === snapshot.estimatedTotalUsd
}
