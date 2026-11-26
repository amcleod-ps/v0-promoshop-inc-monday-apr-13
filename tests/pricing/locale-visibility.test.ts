import assert from "node:assert/strict"
import { test } from "node:test"
import { hasUsdPricing, productsForLocale } from "../../lib/pricing/source"

const tiers = { "XYZ 999": [{}], "BAG 109": [{}] }

test("approved U.S. source SKUs count as USD-priced even without loaded tiers", () => {
  assert.equal(hasUsdPricing({ sku: "TOP 100" }), true)
  assert.equal(hasUsdPricing({ sku: " top  100 " }), true)
})

test("Canadian price SKUs are never USD-priced", () => {
  assert.equal(hasUsdPricing({ sku: "BAG 109" }, tiers), false)
})

test("unlisted SKUs are USD-priced only when the site shows tiers for them", () => {
  assert.equal(hasUsdPricing({ sku: "XYZ 999" }, tiers), true)
  assert.equal(hasUsdPricing({ sku: "XYZ 999" }, {}), false)
  assert.equal(hasUsdPricing({ sku: "NEW 001" }, tiers), false)
})

test("the Canadian site hides USD-priced products and keeps the rest in order", () => {
  const products = [{ sku: "BAG 109" }, { sku: "TOP 100" }, { sku: "NEW 001" }, { sku: "XYZ 999" }]
  assert.deepEqual(productsForLocale(products, "CAN", tiers).map((p) => p.sku), ["BAG 109", "NEW 001"])
})

test("the U.S. site shows every product", () => {
  const products = [{ sku: "BAG 109" }, { sku: "TOP 100" }]
  assert.deepEqual(productsForLocale(products, "USA", tiers), products)
})
