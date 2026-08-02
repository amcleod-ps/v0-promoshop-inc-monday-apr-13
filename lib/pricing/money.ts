const UNIT_SCALE_DIGITS = 4
const UNIT_SCALE_FACTOR = 10_000n
const SCALED_UNITS_PER_CENT = 100n
const MAX_WHOLE_UNIT_PRICE = 100_000_000n
const UNIT_PRICE_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,4}))?$/

function parseUnitPriceUsd(value: string): bigint | null {
  const match = UNIT_PRICE_PATTERN.exec(value)

  if (!match || match[1].length > 8) return null

  const whole = BigInt(match[1])
  if (whole >= MAX_WHOLE_UNIT_PRICE) return null

  const fraction = (match[2] ?? "").padEnd(UNIT_SCALE_DIGITS, "0")
  const scaled = whole * UNIT_SCALE_FACTOR + BigInt(fraction || "0")

  return scaled > 0n ? scaled : null
}

function formatScaledUnitPrice(scaled: bigint): string {
  const whole = scaled / UNIT_SCALE_FACTOR
  const fraction = (scaled % UNIT_SCALE_FACTOR)
    .toString()
    .padStart(UNIT_SCALE_DIGITS, "0")

  return whole.toString() + "." + fraction
}

function formatCents(cents: bigint): string {
  const whole = cents / 100n
  const fraction = (cents % 100n).toString().padStart(2, "0")

  return whole.toString() + "." + fraction
}

/**
 * Returns the canonical four-decimal representation accepted by the database,
 * or null for zero, negative, exponent, over-scale, malformed, or out-of-range
 * input. Money is never parsed through Number or floating-point arithmetic.
 */
export function normalizeUnitPriceUsd(value: string): string | null {
  const scaled = parseUnitPriceUsd(value)
  return scaled === null ? null : formatScaledUnitPrice(scaled)
}

/**
 * Multiplies one canonicalizable USD unit price by a positive safe-integer
 * quantity using BigInt ten-thousandths, then rounds the final SKU subtotal
 * once to cents using half-up rounding.
 */
export function calculateSubtotalUsd(
  unitPriceUsd: string,
  quantity: number,
): string | null {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null

  const scaledUnitPrice = parseUnitPriceUsd(unitPriceUsd)
  if (scaledUnitPrice === null) return null

  const scaledSubtotal = scaledUnitPrice * BigInt(quantity)
  const cents =
    (scaledSubtotal + SCALED_UNITS_PER_CENT / 2n) / SCALED_UNITS_PER_CENT

  return formatCents(cents)
}
