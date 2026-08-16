import assert from "node:assert/strict"
import test from "node:test"

import { buildCustomerPricingSummary } from "../../lib/pricing/customer"

test("combines SKU variants so 30 units use the 24-unit rate", () => {
  const summary = buildCustomerPricingSummary(
    [
      { productSku: "PUL 005", quantity: 6 },
      { productSku: "PUL 005", quantity: 24 },
      { productSku: "NO PRICE", quantity: 5 },
    ],
    {
      "PUL 005": [
        { tierStartQuantity: 1, unitPriceUsd: "97.5000" },
        { tierStartQuantity: 12, unitPriceUsd: "95.0600" },
        { tierStartQuantity: 24, unitPriceUsd: "92.6300" },
        { tierStartQuantity: 48, unitPriceUsd: "85.8000" },
      ],
    },
  )

  assert.equal(summary.hasPricedItems, true)
  assert.equal(summary.hasUnpricedItems, true)
  assert.equal(summary.estimatedTotalUsd, "2778.90")
  assert.deepEqual(summary.bySku["PUL 005"], {
    status: "priced",
    sku: "PUL 005",
    quantity: 30,
    tierStartQuantity: 24,
    unitPriceUsd: "92.6300",
    subtotalUsd: "2778.90",
  })
  assert.deepEqual(summary.bySku["NO PRICE"], {
    status: "unpriced",
    sku: "NO PRICE",
    quantity: 5,
  })
})
