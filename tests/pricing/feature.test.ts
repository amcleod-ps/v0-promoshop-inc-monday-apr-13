import assert from "node:assert/strict"
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
