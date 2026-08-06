import assert from "node:assert/strict"
import test from "node:test"

import {
  buildQuotePricingSnapshot,
  displayedTotalMatches,
  MAX_SNAPSHOT_LINES,
} from "../../lib/pricing/snapshot"
import { sumSubtotalsUsd } from "../../lib/pricing/money"
import type {
  PricingTierMap,
  QuoteLineInput,
  QuotePricingSnapshot,
  SnapshotProduct,
} from "../../lib/pricing/types"

const AT = "2026-08-06T18:00:00.000Z"

function products(
  ...entries: Array<[string, number, boolean?, string?]>
): ReadonlyMap<string, SnapshotProduct> {
  return new Map(
    entries.map(([sku, minimumQuantity, isActive = true, name = `Product ${sku}`]) => [
      sku,
      { sku, name, minimumQuantity, isActive },
    ]),
  )
}

function built(result: ReturnType<typeof buildQuotePricingSnapshot>): QuotePricingSnapshot {
  assert.equal(result.status, "built", `expected a snapshot, got ${JSON.stringify(result)}`)
  return (result as { status: "built"; snapshot: QuotePricingSnapshot }).snapshot
}

const TIERS: PricingTierMap = {
  "SKU-A": [
    { tierStartQuantity: 12, unitPriceUsd: "10.0000" },
    { tierStartQuantity: 48, unitPriceUsd: "8.5000" },
    { tierStartQuantity: 144, unitPriceUsd: "7.2500" },
  ],
  "SKU-B": [{ tierStartQuantity: 25, unitPriceUsd: "3.3333" }],
}

test("tiers are selected on the quantity aggregated across variants", () => {
  // 20 + 20 + 20 = 60, which reaches the 48 tier even though no single
  // colour line does. This is the whole point of per-SKU aggregation.
  const lines: QuoteLineInput[] = [
    { sku: "SKU-A", colour: "Black", size: "M", quantity: 20 },
    { sku: "SKU-A", colour: "Black", size: "L", quantity: 20 },
    { sku: "SKU-A", colour: "Navy", size: "M", quantity: 20 },
  ]

  const snapshot = built(
    buildQuotePricingSnapshot(lines, products(["SKU-A", 12]), TIERS, AT),
  )

  assert.equal(snapshot.skus.length, 1)
  const [sku] = snapshot.skus
  assert.equal(sku.status, "priced")
  assert.equal(sku.aggregatedQuantity, 60)
  assert.equal(sku.tierStartQuantity, 48)
  assert.equal(sku.unitPriceUsd, "8.5000")
  assert.equal(sku.subtotalUsd, "510.00")
  assert.equal(sku.lines.length, 3)
  assert.equal(snapshot.estimatedTotalUsd, "510.00")
})

test("each SKU rounds once and the total is the exact sum of those figures", () => {
  // 3.3333 x 25 = 83.3325, which must round half-up to 83.33 exactly once.
  const snapshot = built(
    buildQuotePricingSnapshot(
      [
        { sku: "SKU-A", quantity: 12 },
        { sku: "SKU-B", quantity: 25 },
      ],
      products(["SKU-A", 12], ["SKU-B", 25]),
      TIERS,
      AT,
    ),
  )

  const bySku = new Map(snapshot.skus.map((sku) => [sku.sku, sku]))
  assert.equal(bySku.get("SKU-A")?.subtotalUsd, "120.00")
  assert.equal(bySku.get("SKU-B")?.subtotalUsd, "83.33")
  assert.equal(snapshot.estimatedTotalUsd, "203.33")
})

test("large quantities stay exact with no floating-point artefact", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-B", quantity: 1_000_000 }],
      products(["SKU-B", 25]),
      TIERS,
      AT,
    ),
  )

  assert.equal(snapshot.estimatedTotalUsd, "3333300.00")
  assert.doesNotMatch(snapshot.estimatedTotalUsd ?? "", /e|\+/i)
})

test("a quantity below the MOQ is recorded unpriced, not guessed", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-A", quantity: 11 }],
      products(["SKU-A", 12]),
      TIERS,
      AT,
    ),
  )

  const [sku] = snapshot.skus
  assert.equal(sku.status, "below_moq")
  assert.equal(sku.unitPriceUsd, null)
  assert.equal(sku.subtotalUsd, null)
  assert.equal(sku.minimumQuantity, 12)
  assert.equal(snapshot.estimatedTotalUsd, null)
  assert.equal(snapshot.pricedSkuCount, 0)
  assert.equal(snapshot.unpricedSkuCount, 1)
})

test("unknown and retired SKUs are distinguished and both stay unpriced", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [
        { sku: "SKU-A", quantity: 12 },
        { sku: "SKU-GONE", quantity: 50, productName: "Removed from catalogue" },
        { sku: "SKU-OLD", quantity: 50 },
      ],
      products(["SKU-A", 12], ["SKU-OLD", 12, false]),
      TIERS,
      AT,
    ),
  )

  const bySku = new Map(snapshot.skus.map((sku) => [sku.sku, sku]))
  assert.equal(bySku.get("SKU-GONE")?.status, "unknown_sku")
  assert.equal(bySku.get("SKU-OLD")?.status, "inactive_sku")
  assert.equal(bySku.get("SKU-OLD")?.subtotalUsd, null)

  // The total covers only what could actually be priced, and the count says so.
  assert.equal(snapshot.estimatedTotalUsd, "120.00")
  assert.equal(snapshot.pricedSkuCount, 1)
  assert.equal(snapshot.unpricedSkuCount, 2)
})

test("an unknown SKU falls back to the cart's name only for identification", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-GONE", quantity: 5, productName: "  What they saw  " }],
      products(),
      {},
      AT,
    ),
  )

  assert.equal(snapshot.skus[0].productName, "What they saw")
})

test("the catalogue name wins over anything the cart claims", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-A", quantity: 12, productName: "Free Sample" }],
      products(["SKU-A", 12, true, "Genuine Catalogue Name"]),
      TIERS,
      AT,
    ),
  )

  assert.equal(snapshot.skus[0].productName, "Genuine Catalogue Name")
})

test("a SKU with no loaded tiers is unpriced rather than free", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-C", quantity: 100 }],
      products(["SKU-C", 12]),
      {},
      AT,
    ),
  )

  assert.equal(snapshot.skus[0].status, "no_tiers")
  assert.equal(snapshot.estimatedTotalUsd, null)
})

test("a tier set that fails validation fails closed", () => {
  // First tier does not start at the MOQ, so the engine rejects the set.
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-A", quantity: 100 }],
      products(["SKU-A", 6]),
      TIERS,
      AT,
    ),
  )

  assert.equal(snapshot.skus[0].status, "invalid_tiers")
  assert.equal(snapshot.skus[0].unitPriceUsd, null)
  assert.equal(snapshot.estimatedTotalUsd, null)
})

test("the record is ordered by SKU regardless of cart order", () => {
  const forward = built(
    buildQuotePricingSnapshot(
      [
        { sku: "SKU-B", quantity: 25 },
        { sku: "SKU-A", quantity: 12 },
      ],
      products(["SKU-A", 12], ["SKU-B", 25]),
      TIERS,
      AT,
    ),
  )
  const reverse = built(
    buildQuotePricingSnapshot(
      [
        { sku: "SKU-A", quantity: 12 },
        { sku: "SKU-B", quantity: 25 },
      ],
      products(["SKU-A", 12], ["SKU-B", 25]),
      TIERS,
      AT,
    ),
  )

  assert.deepEqual(
    forward.skus.map((sku) => sku.sku),
    ["SKU-A", "SKU-B"],
  )
  assert.deepEqual(forward, reverse)
})

test("a price smuggled into a cart line cannot reach the snapshot", () => {
  const tampered = [
    {
      sku: "SKU-A",
      quantity: 12,
      unitPriceUsd: "0.0001",
      subtotalUsd: "0.01",
      estimatedTotalUsd: "0.01",
    },
  ] as unknown as QuoteLineInput[]

  const snapshot = built(
    buildQuotePricingSnapshot(tampered, products(["SKU-A", 12]), TIERS, AT),
  )

  assert.equal(snapshot.skus[0].unitPriceUsd, "10.0000")
  assert.equal(snapshot.estimatedTotalUsd, "120.00")
  assert.doesNotMatch(JSON.stringify(snapshot), /0\.0001/)
})

test("malformed carts are refused instead of half-priced", () => {
  const ok = products(["SKU-A", 12])

  assert.deepEqual(buildQuotePricingSnapshot([], ok, TIERS, AT), {
    status: "failed",
    reason: "no_lines",
  })

  assert.deepEqual(
    buildQuotePricingSnapshot(
      Array.from({ length: MAX_SNAPSHOT_LINES + 1 }, () => ({
        sku: "SKU-A",
        quantity: 1,
      })),
      ok,
      TIERS,
      AT,
    ),
    { status: "failed", reason: "too_many_lines" },
  )

  for (const bad of [
    { sku: "", quantity: 5 },
    { sku: "SKU-A", quantity: 0 },
    { sku: "SKU-A", quantity: -3 },
    { sku: "SKU-A", quantity: 2.5 },
    { sku: "SKU-A", quantity: Number.NaN },
  ]) {
    assert.deepEqual(
      buildQuotePricingSnapshot([bad as QuoteLineInput], ok, TIERS, AT),
      { status: "failed", reason: "invalid_line" },
      `expected refusal for ${JSON.stringify(bad)}`,
    )
  }
})

test("displayed totals must match exactly to avoid a review", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-A", quantity: 12 }],
      products(["SKU-A", 12]),
      TIERS,
      AT,
    ),
  )

  assert.equal(displayedTotalMatches(snapshot, "120.00"), true)
  assert.equal(displayedTotalMatches(snapshot, " 120.00 "), true)

  // A stale, absent or unparseable figure is not agreement.
  assert.equal(displayedTotalMatches(snapshot, "119.99"), false)
  assert.equal(displayedTotalMatches(snapshot, undefined), false)
  assert.equal(displayedTotalMatches(snapshot, "120"), false)
  assert.equal(displayedTotalMatches(snapshot, "$120.00"), false)
  assert.equal(displayedTotalMatches(snapshot, "1e2"), false)
})

test("an unpriced cart never claims a displayed total matched", () => {
  const snapshot = built(
    buildQuotePricingSnapshot(
      [{ sku: "SKU-A", quantity: 11 }],
      products(["SKU-A", 12]),
      TIERS,
      AT,
    ),
  )

  assert.equal(snapshot.estimatedTotalUsd, null)
  assert.equal(displayedTotalMatches(snapshot, "0.00"), false)
})

test("subtotals sum exactly and reject anything non-canonical", () => {
  assert.equal(sumSubtotalsUsd([]), "0.00")
  assert.equal(sumSubtotalsUsd(["0.01", "0.02"]), "0.03")
  assert.equal(sumSubtotalsUsd(["0.10", "0.20"]), "0.30")
  assert.equal(
    sumSubtotalsUsd(["99999999.99", "0.01"]),
    "100000000.00",
  )

  for (const bad of ["120", "120.0", "120.000", "1e2", "-1.00", "", " 1.00"]) {
    assert.equal(sumSubtotalsUsd([bad]), null, `expected null for "${bad}"`)
  }
})

test("totals stay exact above the float-safe integer range", () => {
  // A cart is bounded at 200 lines of up to 1,000,000 units, and a unit price
  // may approach 100,000,000, so a subtotal can exceed 2^53 cents
  // (90,071,992,547,409.91). Past that point Number arithmetic silently
  // returns a neighbouring value, which is why these are summed as BigInt
  // cents parsed from the string rather than through Number at any stage.
  assert.equal(
    sumSubtotalsUsd(["90071992547409.93"]),
    "90071992547409.93",
  )
  assert.equal(
    sumSubtotalsUsd(["99999999999999.99"]),
    "99999999999999.99",
  )
  assert.equal(
    sumSubtotalsUsd(["90071992547409.93", "0.01"]),
    "90071992547409.94",
  )
  assert.equal(
    sumSubtotalsUsd(["99999999999999.99", "99999999999999.99"]),
    "199999999999999.98",
  )
})
