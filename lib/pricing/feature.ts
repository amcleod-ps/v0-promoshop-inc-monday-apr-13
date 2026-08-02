export type PricingEnvironment = Readonly<
  Record<string, string | undefined>
>

/**
 * Server-owned release gate. It is deliberately strict and defaults off:
 * only the exact lowercase string "true" enables pricing code paths.
 */
export function isTieredPricingEnabled(
  environment: PricingEnvironment = process.env,
): boolean {
  return environment.TIERED_PRICING_ENABLED === "true"
}
