import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { isTieredPricingEnabled } from "../../lib/pricing/feature"

test("pricing defaults off and accepts only exact lowercase true", () => {
  for (const value of [undefined, "", "false", "1", "yes", "TRUE"]) {
    assert.equal(
      isTieredPricingEnabled({ TIERED_PRICING_ENABLED: value }),
      false,
    )
  }

  assert.equal(
    isTieredPricingEnabled({ TIERED_PRICING_ENABLED: "true" }),
    true,
  )
})

test("home pricing copy is protected by the customer release gate", () => {
  const source = readFileSync("app/page.tsx", "utf8")

  assert.match(source, /getCustomerPricingReleaseEnabled\(\)/)
  assert.match(source, /pricingReleased \? \(/)
})
