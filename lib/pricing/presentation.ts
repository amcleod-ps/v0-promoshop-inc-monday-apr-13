import type { PriceTier } from "./types"
import type { PricingCurrency } from "./source"

/**
 * Regional notice text supplied by the client on September 30. Public
 * components read the editable values through lib/pricing/notices.ts.
 * The generic estimate applies when the product source is unknown.
 */
export const APPROXIMATE_PRICING_COPY =
  "Final pricing may vary depending on decoration, artwork, quantities, shipping, and current supplier costs. Once you submit your quote request, a PromoShop specialist will review your selections and provide a customized quote with confirmed pricing."

export const CANADA_CANADIAN_PRICING_COPY =
  "Final pricing may vary depending on decoration, artwork, quantities, shipping, and provincial taxes. Once you submit your quote request, a PromoShop specialist will review your selections and provide a customized quote with confirmed pricing."

export const CANADA_USA_PRICING_COPY =
  "Product sourced from USA. PromoShop team will convert pricing to CAD based on exchange rates, duties, taxes, and shipping."

export const USA_CANADIAN_PRICING_COPY =
  "Product sourced from Canada. PromoShop team will convert pricing to USD based on exchange rates, duties, taxes, and shipping."

export const USA_USA_PRICING_COPY =
  "Final pricing may vary depending on decoration, artwork, quantities, shipping, and state taxes. Once you submit your quote request, a PromoShop specialist will review your selections and provide a customized quote with confirmed pricing."

export const NO_PRICING_COPY =
  "Pricing unavailable at this time"

export const LARGE_QUANTITY_START = 48

export const LARGE_QUANTITY_COPY =
  "Planning 48 or more units? Contact our team for better pricing on larger quantities."

export function tierPriceBasisLabel(tierStartQuantity: number): string {
  return tierStartQuantity === 1 ? "No decoration" : "With decoration"
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
  return formatPrice(value, "USD", options)
}

export function formatPrice(
  value: string,
  currency: PricingCurrency,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${currency} pricing unavailable`

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
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
