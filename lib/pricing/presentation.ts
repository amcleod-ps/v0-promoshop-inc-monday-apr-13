import type { PriceTier } from "./types"

/** Exact public wording supplied in the August 7 pricing package. */
export const APPROXIMATE_PRICING_COPY =
  "Pricing shown is for budgeting purposes only and is based on estimated U.S. costs. Final pricing may vary depending on decoration, artwork, quantities, shipping, and current supplier costs. Once you submit your quote request, a PromoShop specialist will review your selections and provide a customized quote with confirmed pricing."

export const CANADIAN_PRICING_COPY =
  "We're currently finalizing Canadian pricing for these products. In the meantime, please reference the U.S. pricing for a general budget estimate. Final Canadian pricing will vary based on decoration, shipping, exchange rates, and supplier availability. Submit your quote request and our team will provide accurate Canadian pricing."

export const NO_PRICING_COPY =
  "Add this product to your quote and our team will reach out with accurate pricing. Please note: your subtotal will not reflect this item when you submit your quote."

export const LARGE_QUANTITY_START = 48

export const LARGE_QUANTITY_COPY =
  "Planning 48 or more units? Contact our team for better pricing on larger quantities."

export function tierPriceBasisLabel(tierStartQuantity: number): string {
  return tierStartQuantity === 1 ? "No decoration" : "With decoration"
}

/**
 * The source sheet places these SKUs in its Canadian-pricing section. Every
 * other SKU without an enabled USD tier set follows the supplied no-pricing
 * copy. This is a presentation classification, not a price or currency rule.
 */
export const CANADIAN_PRICING_SKUS = [
  "BAG 109",
  "BAG 110",
  "SWE 105",
  "TOP 105",
  "TOP 106",
  "TUM 103",
  "TUM 104",
  "BAG 129",
  "TUM 105",
  "TUM 106",
  "TUM 107",
  "VEST 001",
  "TOP 103",
  "SWE 103",
] as const

const CANADIAN_SKU_SET = new Set<string>(CANADIAN_PRICING_SKUS)

export type MissingPricingKind = "canadian" | "unpriced"

export function missingPricingKind(sku: string): MissingPricingKind {
  return CANADIAN_SKU_SET.has(sku.trim()) ? "canadian" : "unpriced"
}

export function missingPricingCopy(sku: string): string {
  return missingPricingKind(sku) === "canadian"
    ? CANADIAN_PRICING_COPY
    : NO_PRICING_COPY
}

/**
 * Currency rendering is presentation-only. Calculations stay in the exact
 * string/BigInt helpers in money.ts, so this function is never an input to a
 * price calculation or submission decision.
 */
export function formatUsd(
  value: string,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "USD pricing unavailable"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 4,
  }).format(amount)
}

export function tierRangeLabel(
  tiers: readonly PriceTier[],
  index: number,
): string {
  const start = tiers[index]?.tierStartQuantity
  const next = tiers[index + 1]?.tierStartQuantity
  if (!Number.isSafeInteger(start) || start <= 0) return "Quantity unavailable"
  if (!Number.isSafeInteger(next) || next <= start) return `${start}+ units`
  return `${start}-${next - 1} units`
}
