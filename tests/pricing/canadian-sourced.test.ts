import assert from "node:assert/strict"
import test from "node:test"

import { isCanadianSourced } from "../../lib/canadian-sourced"

test("only CAD-priced SKUs count as Canadian sourced", () => {
  for (const sku of ["BAG 109", "BAG 110", "SWE 105", "TUM 103", "TUM 104", "BAG 129", "TUM 105", "TUM 106", "TUM 107"]) {
    assert.equal(isCanadianSourced({ sku }), true, sku)
  }
})

test("the sourced-from-canada tag alone does not add the leaf", () => {
  assert.equal(isCanadianSourced({ sku: "ACC 002", tags: ["canada", "sourced from canada"] }), false)
  assert.equal(isCanadianSourced({ sku: "NEW 001", tags: ["sourced from canada"] }), false)
})
