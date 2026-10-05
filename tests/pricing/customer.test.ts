import assert from "node:assert/strict"
import test from "node:test"

import { buildCustomerPricingSummary } from "../../lib/pricing/customer"
import { tierPriceBasisLabel } from "../../lib/pricing/presentation"

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
  assert.equal(summary.hasLargeQuantityItems, false)
  assert.equal(summary.estimatedTotalUsd, "2778.90")
  assert.deepEqual(summary.bySku["PUL 005"], {
    status: "priced",
    sku: "PUL 005",
    quantity: 30,
    tierStartQuantity: 24,
    currency: "USD",
    unitPrice: "92.6300",
    subtotal: "2778.90",
    unitPriceUsd: "92.6300",
    subtotalUsd: "2778.90",
  })
  assert.deepEqual(summary.bySku["NO PRICE"], {
    status: "unpriced",
    sku: "NO PRICE",
    quantity: 5,
  })
})

test("Canadian amounts keep their entered values and do not join USD totals", () => {
  const summary = buildCustomerPricingSummary(
    [
      { productSku: "TUM 106", quantity: 12 },
      { productSku: "PUL 005", quantity: 12 },
    ],
    {
      "TUM 106": [{ tierStartQuantity: 1, unitPriceUsd: "39.9900" }],
      "PUL 005": [{ tierStartQuantity: 1, unitPriceUsd: "10.0000" }],
    },
  )
  assert.deepEqual(summary.estimatedTotalsByCurrency, { CAD: "479.88", USD: "120.00" })
  assert.equal(summary.estimatedTotalUsd, "120.00")
  const canadian = summary.bySku["TUM 106"]
  assert.equal(canadian.status, "priced")
  if (canadian.status === "priced") {
    assert.equal(canadian.currency, "CAD")
    assert.equal(canadian.unitPrice, "39.9900")
    assert.equal(canadian.unitPriceUsd, null)
  }
})

test("a CAD-only cart remains priced without a USD estimate", () => {
  const summary = buildCustomerPricingSummary(
    [{ productSku: "TUM 106", quantity: 1 }],
    { "TUM 106": [{ tierStartQuantity: 1, unitPriceUsd: "39.9900" }] },
  )
  assert.equal(summary.hasPricedItems, true)
  assert.equal(summary.estimatedTotalUsd, null)
  assert.deepEqual(summary.estimatedTotalsByCurrency, { CAD: "39.99" })
})

test("shows the large-quantity prompt from 48 combined units", () => {
  const tiers = {
    "ACC 002": [
      { tierStartQuantity: 1, unitPriceUsd: "140.0000" },
      { tierStartQuantity: 48, unitPriceUsd: "123.2000" },
    ],
  }

  const below = buildCustomerPricingSummary(
    [{ productSku: "ACC 002", quantity: 47 }],
    tiers,
  )
  assert.equal(below.hasLargeQuantityItems, false)

  const atBreak = buildCustomerPricingSummary(
    [
      { productSku: "ACC 002", quantity: 24 },
      { productSku: "ACC 002", quantity: 24 },
    ],
    tiers,
  )
  assert.equal(atBreak.hasLargeQuantityItems, true)
  assert.equal(atBreak.bySku["ACC 002"]?.status, "priced")
  assert.equal(atBreak.bySku["ACC 002"]?.tierStartQuantity, 48)
})

test("labels the source-defined decoration basis", () => {
  assert.equal(tierPriceBasisLabel(1), "No decoration")
  assert.equal(tierPriceBasisLabel(12), "With decoration")
  assert.equal(tierPriceBasisLabel(24), "With decoration")
  assert.equal(tierPriceBasisLabel(48), "With decoration")
})
