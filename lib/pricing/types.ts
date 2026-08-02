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
