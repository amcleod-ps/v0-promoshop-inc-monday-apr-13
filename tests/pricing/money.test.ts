import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateSubtotalUsd,
  normalizeUnitPriceUsd,
} from "../../lib/pricing/money"

test("normalizes valid unit prices to four decimals", () => {
  assert.equal(normalizeUnitPriceUsd("0.10"), "0.1000")
  assert.equal(normalizeUnitPriceUsd("12.3456"), "12.3456")
  assert.equal(normalizeUnitPriceUsd("99999999.9999"), "99999999.9999")
})

test("rejects ambiguous or out-of-contract unit prices", () => {
  for (const value of [
    "",
    "0",
    "0.0000",
    "-1",
    "01.00",
    "1.",
    ".5",
    "1.23456",
    "1e3",
    "NaN",
    "100000000",
  ]) {
    assert.equal(normalizeUnitPriceUsd(value), null, value)
  }
})

test("multiplies exactly and rounds the final subtotal half up to cents", () => {
  assert.equal(calculateSubtotalUsd("0.10", 3), "0.30")
  assert.equal(calculateSubtotalUsd("0.005", 1), "0.01")
  assert.equal(calculateSubtotalUsd("12.3456", 3), "37.04")
})

test("formats a large valid subtotal without exponent or float artifacts", () => {
  assert.equal(
    calculateSubtotalUsd("9999.9999", 100_000),
    "999999990.00",
  )
})

test("rejects invalid quantities", () => {
  assert.equal(calculateSubtotalUsd("1.0000", 0), null)
  assert.equal(calculateSubtotalUsd("1.0000", -1), null)
  assert.equal(calculateSubtotalUsd("1.0000", 1.5), null)
  assert.equal(calculateSubtotalUsd("1.0000", Number.MAX_SAFE_INTEGER + 1), null)
})
