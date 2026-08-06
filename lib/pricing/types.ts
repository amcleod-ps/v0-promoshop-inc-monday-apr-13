export interface PriceTier {
  readonly tierStartQuantity: number
  readonly unitPriceUsd: string
}

export type PricingTierMap = Readonly<Record<string, readonly PriceTier[]>>

export interface PricingInput {
  readonly quantity: number
  readonly minimumQuantity: number
  readonly tiers: readonly PriceTier[]
}

export interface QuantityLine {
  readonly sku: string
  readonly quantity: number
}

export type InvalidInputReason = "quantity" | "minimum_quantity"

export type InvalidTierReason =
  | "invalid_start"
  | "first_tier_must_match_moq"
  | "non_increasing_starts"
  | "invalid_price"

/**
 * One cart line as received from the browser. Deliberately carries no price,
 * tier or subtotal field: the submission path cannot accept a client-supplied
 * amount because there is nowhere in this type to put one.
 */
export interface QuoteLineInput {
  readonly sku: string
  readonly productName?: string
  readonly colour?: string
  readonly size?: string
  readonly quantity: number
}

/** Catalogue facts read server-side at submission time, never from the cart. */
export interface SnapshotProduct {
  readonly sku: string
  readonly name: string
  readonly minimumQuantity: number
  readonly isActive: boolean
}

export type SnapshotSkuStatus =
  | "priced"
  | "below_moq"
  | "no_tiers"
  | "unknown_sku"
  | "inactive_sku"
  | "invalid_tiers"

export interface SnapshotVariantLine {
  readonly colour: string | null
  readonly size: string | null
  readonly quantity: number
}

/**
 * The SKU is the unit of account, not the cart line. Tiers are selected on the
 * quantity aggregated across a SKU's colour and size lines, and the money is
 * rounded once at this level, so nesting the variants underneath removes any
 * question of which figure is authoritative.
 */
export interface SnapshotSku {
  readonly sku: string
  readonly productName: string | null
  readonly status: SnapshotSkuStatus
  readonly aggregatedQuantity: number
  readonly minimumQuantity: number | null
  readonly tierStartQuantity: number | null
  readonly unitPriceUsd: string | null
  readonly subtotalUsd: string | null
  readonly lines: readonly SnapshotVariantLine[]
}

export interface QuotePricingSnapshot {
  readonly version: 1
  readonly currency: "USD"
  readonly calculatedAt: string
  readonly skus: readonly SnapshotSku[]
  readonly pricedSkuCount: number
  readonly unpricedSkuCount: number
  /** Null when no SKU priced, so an empty estimate is never shown as 0.00. */
  readonly estimatedTotalUsd: string | null
}

export type SnapshotFailureReason =
  | "no_lines"
  | "too_many_lines"
  | "invalid_line"
  | "aggregation_failed"
  | "total_arithmetic_failed"

export type QuoteSnapshotResult =
  | { readonly status: "built"; readonly snapshot: QuotePricingSnapshot }
  | {
      readonly status: "failed"
      readonly reason: SnapshotFailureReason
    }

export type PricingCalculation =
  | {
      readonly status: "priced"
      readonly currency: "USD"
      readonly quantity: number
      readonly minimumQuantity: number
      readonly tierStartQuantity: number
      readonly unitPriceUsd: string
      readonly subtotalUsd: string
    }
  | {
      readonly status: "below_moq"
      readonly quantity: number
      readonly minimumQuantity: number
    }
  | {
      readonly status: "missing_tiers"
      readonly quantity: number
      readonly minimumQuantity: number
    }
  | {
      readonly status: "invalid_input"
      readonly reason: InvalidInputReason
    }
  | {
      readonly status: "invalid_tiers"
      readonly reason: InvalidTierReason
    }
