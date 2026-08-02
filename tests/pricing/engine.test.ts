import assert from "node:assert/strict"
import test from "node:test"

import {
  aggregateQuantitiesBySku,
  calculateTieredPrice,
} from "../../lib/pricing/engine"
import type { PriceTier } from "../../lib/pricing/types"

const tiers: readonly PriceTier[] = [
  { tierStartQuantity: 25, unitPriceUsd: "12.3456" },
  { tierStartQuantity: 50, unitPriceUsd: "10.00" },
  { tierStartQuantity: 100, unitPriceUsd: "8.1250" },
]

test("selects the first tier at MOQ", () => {
  assert.deepEqual(
    calculateTieredPrice({
      quantity: 25,
      minimumQuantity: 25,
      tiers,
    }),
    {
      status: "priced",
      currency: "USD",
      quantity: 25,
      minimumQuantity: 25,
      tierStartQuantity: 25,
      unitPriceUsd: "12.3456",
      subtotalUsd: "308.64",
    },
  )
})

test("keeps a tier continuous until the next start", () => {
  const beforeBoundary = calculateTieredPrice({
    quantity: 49,
    minimumQuantity: 25,
    tiers,
  })
  const atBoundary = calculateTieredPrice({
    quantity: 50,
    minimumQuantity: 25,
    tiers,
  })

  assert.equal(beforeBoundary.status, "priced")
  assert.equal(
    beforeBoundary.status === "priced"
      ? beforeBoundary.tierStartQuantity
      : null,
    25,
  )
  assert.equal(
    beforeBoundary.status === "priced" ? beforeBoundary.subtotalUsd : null,
    "604.93",
  )

  assert.equal(atBoundary.status, "priced")
  assert.equal(
    atBoundary.status === "priced" ? atBoundary.tierStartQuantity : null,
    50,
  )
  assert.equal(
    atBoundary.status === "priced" ? atBoundary.subtotalUsd : null,
    "500.00",
  )
})

test("uses the final tier without an upper bound", () => {
  const exact = calculateTieredPrice({
    quantity: 100,
    minimumQuantity: 25,
    tiers,
  })
  const beyond = calculateTieredPrice({
    quantity: 250,
    minimumQuantity: 25,
    tiers,
  })

  assert.equal(exact.status, "priced")
  assert.equal(
    exact.status === "priced" ? exact.subtotalUsd : null,
    "812.50",
  )
  assert.equal(beyond.status, "priced")
  assert.equal(
    beyond.status === "priced" ? beyond.tierStartQuantity : null,
    100,
  )
  assert.equal(
    beyond.status === "priced" ? beyond.subtotalUsd : null,
    "2031.25",
  )
})

test("withholds money fields below MOQ", () => {
  const result = calculateTieredPrice({
    quantity: 24,
    minimumQuantity: 25,
    tiers,
  })

  assert.deepEqual(result, {
    status: "below_moq",
    quantity: 24,
    minimumQuantity: 25,
  })
  assert.equal("unitPriceUsd" in result, false)
  assert.equal("subtotalUsd" in result, false)
})

test("never invents a price for an empty tier set", () => {
  const result = calculateTieredPrice({
    quantity: 25,
    minimumQuantity: 25,
    tiers: [],
  })

  assert.deepEqual(result, {
    status: "missing_tiers",
    quantity: 25,
    minimumQuantity: 25,
  })
  assert.equal("unitPriceUsd" in result, false)
  assert.equal("subtotalUsd" in result, false)
})

test("rejects invalid inputs and invalid tier sets", () => {
  assert.deepEqual(
    calculateTieredPrice({
      quantity: 1.5,
      minimumQuantity: 25,
      tiers,
    }),
    { status: "invalid_input", reason: "quantity" },
  )

  assert.deepEqual(
    calculateTieredPrice({
      quantity: 25,
      minimumQuantity: 0,
      tiers,
    }),
    { status: "invalid_input", reason: "minimum_quantity" },
  )

  assert.deepEqual(
    calculateTieredPrice({
      quantity: 25,
      minimumQuantity: 25,
      tiers: [{ tierStartQuantity: 30, unitPriceUsd: "1.00" }],
    }),
    { status: "invalid_tiers", reason: "first_tier_must_match_moq" },
  )

  assert.deepEqual(
    calculateTieredPrice({
      quantity: 50,
      minimumQuantity: 25,
      tiers: [
        { tierStartQuantity: 25, unitPriceUsd: "1.00" },
        { tierStartQuantity: 25, unitPriceUsd: "0.90" },
      ],
    }),
    { status: "invalid_tiers", reason: "non_increasing_starts" },
  )

  assert.deepEqual(
    calculateTieredPrice({
      quantity: 25,
      minimumQuantity: 25,
      tiers: [{ tierStartQuantity: 25, unitPriceUsd: "1.23456" }],
    }),
    { status: "invalid_tiers", reason: "invalid_price" },
  )
})

test("aggregates colour and size variants by case-preserved SKU", () => {
  const quantities = aggregateQuantitiesBySku([
    { sku: " SKU-1 ", quantity: 10 },
    { sku: "SKU-1", quantity: 15 },
    { sku: "sku-1", quantity: 2 },
  ])

  assert.deepEqual(
    quantities,
    new Map([
      ["SKU-1", 25],
      ["sku-1", 2],
    ]),
  )
})

test("fails the complete aggregation for invalid lines or overflow", () => {
  assert.equal(
    aggregateQuantitiesBySku([{ sku: " ", quantity: 1 }]),
    null,
  )
  assert.equal(
    aggregateQuantitiesBySku([{ sku: "SKU-1", quantity: 0 }]),
    null,
  )
  assert.equal(
    aggregateQuantitiesBySku([
      { sku: "SKU-1", quantity: Number.MAX_SAFE_INTEGER },
      { sku: "SKU-1", quantity: 1 },
    ]),
    null,
  )
})
