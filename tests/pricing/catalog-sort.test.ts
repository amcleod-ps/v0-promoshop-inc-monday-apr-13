import { test } from "node:test"
import assert from "node:assert/strict"
import { catalogStartingPrice, sortProductsByPrice } from "../../lib/pricing/catalog-sort"
import { productPriceCurrency } from "../../lib/pricing/source"
import type { PricingTierMap } from "../../lib/pricing/types"

const tiers: PricingTierMap = {
  expensive: [{ tierStartQuantity: 1, unitPriceUsd: "100.0000" }, { tierStartQuantity: 24, unitPriceUsd: "1.0000" }],
  cheap: [{ tierStartQuantity: 12, unitPriceUsd: "9.1234" }],
  equal: [{ tierStartQuantity: 1, unitPriceUsd: "9.1234" }],
  invalid: [{ tierStartQuantity: 1, unitPriceUsd: "NaN" }],
}

test("price sorting uses the first quantity tier, keeps ties stable, and puts missing prices last", () => {
  const products = ["missing", "expensive", "cheap", "equal", "invalid"].map((sku) => ({ sku }))
  const original = [...products]
  assert.deepEqual(sortProductsByPrice(products, tiers).map((product) => product.sku), ["cheap", "equal", "expensive", "missing", "invalid"])
  assert.deepEqual(products, original)
  assert.equal(catalogStartingPrice("expensive", tiers), "100.0000")
})

test("sorting preserves a filtered subset and does not add products or alter currency", () => {
  const products = [{ sku: "BAG 109" }, { sku: "ACC 002" }]
  const pricing: PricingTierMap = {
    "BAG 109": [{ tierStartQuantity: 1, unitPriceUsd: "20.0000" }],
    "ACC 002": [{ tierStartQuantity: 1, unitPriceUsd: "10.0000" }],
  }
  const currencies = products.map((product) => productPriceCurrency(product.sku))
  assert.deepEqual(currencies, ["CAD", "USD"])
  const result = sortProductsByPrice(products, pricing)
  assert.deepEqual(result, [products[1], products[0]])
  assert.deepEqual(products.map((product) => productPriceCurrency(product.sku)), currencies)
  assert.deepEqual(pricing["BAG 109"], [{ tierStartQuantity: 1, unitPriceUsd: "20.0000" }])
})

test("invalid prices never act as zero and an unavailable price map preserves the catalog", () => {
  const products = [{ sku: "a" }, { sku: "b" }]
  for (const unitPriceUsd of ["0", "-1", "1e3", "Infinity", "1.00001"]) {
    assert.equal(catalogStartingPrice("a", { a: [{ tierStartQuantity: 1, unitPriceUsd }] }), null)
  }
  assert.equal(catalogStartingPrice("a", { a: [{ tierStartQuantity: 0, unitPriceUsd: "10.0000" }] }), null)
  assert.deepEqual(sortProductsByPrice(products, {}), products)
})
