import assert from "node:assert/strict"
import test from "node:test"

import {
  PRICING_MATRIX_HEADER,
  dryRunPricingMatrixCsv,
  parseCsvRecords,
  validateTierSetDraft,
} from "../../lib/pricing/matrix"

const header = PRICING_MATRIX_HEADER.join(",")
const catalog = [
  { sku: "SYN-001", name: "Synthetic Mug", minimumQuantity: 12 },
  { sku: "SYN-002", name: "Synthetic Bag, Large", minimumQuantity: 25 },
]

function csv(...rows: string[]): string {
  return [header, ...rows].join("\n")
}

test("accepts a complete valid matrix and canonicalizes prices", async () => {
  const result = await dryRunPricingMatrixCsv(
    csv(
      "SYN-001,Synthetic Mug,12,12,10.5,first",
      "SYN-001,Synthetic Mug,12,24,9.2500,second",
      '"SYN-002","Synthetic Bag, Large",25,25,3.125,"quoted, note"',
    ),
    catalog,
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.rowCount, 3)
  assert.equal(result.skuCount, 2)
  assert.equal(result.sets[0].tiers[0].unitPriceUsd, "10.5000")
  assert.match(result.fingerprint, /^[0-9a-f]{64}$/)
})

test("supports BOM, CRLF, escaped quotes, and embedded quoted newlines", async () => {
  const source =
    "\uFEFF" +
    header +
    "\r\n" +
    'SYN-001,Synthetic Mug,12,12,1.0000,"line one\r\nline ""two"""'

  const parsed = parseCsvRecords(source)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.records.length, 2)
  assert.equal(parsed.records[1].fields[5], 'line one\nline "two"')

  const result = await dryRunPricingMatrixCsv(source, catalog)
  assert.equal(result.ok, true)
})

test("rejects empty, header-only, and blank-row files", async () => {
  const empty = await dryRunPricingMatrixCsv("", catalog)
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.ok(empty.diagnostics.some((d) => d.code === "empty_file"))

  const headerOnly = await dryRunPricingMatrixCsv(header, catalog)
  assert.equal(headerOnly.ok, false)
  if (!headerOnly.ok) {
    assert.ok(headerOnly.diagnostics.some((d) => d.code === "no_data_rows"))
  }

  const blank = await dryRunPricingMatrixCsv(header + "\n,,,,,", catalog)
  assert.equal(blank.ok, false)
  if (!blank.ok) assert.ok(blank.diagnostics.some((d) => d.code === "blank_row"))
})

test("requires the exact six-column header and row width", async () => {
  const wrongHeader = await dryRunPricingMatrixCsv(
    header.replace("sku", "SKU") + "\nSYN-001,Synthetic Mug,12,12,1.00,n",
    catalog,
  )
  assert.equal(wrongHeader.ok, false)
  if (!wrongHeader.ok) {
    assert.ok(wrongHeader.diagnostics.some((d) => d.code === "invalid_header"))
  }

  const wrongWidth = await dryRunPricingMatrixCsv(
    header + "\nSYN-001,Synthetic Mug,12,12,1.00",
    catalog,
  )
  assert.equal(wrongWidth.ok, false)
  if (!wrongWidth.ok) {
    assert.ok(wrongWidth.diagnostics.some((d) => d.code === "wrong_column_count"))
  }
})

test("rejects malformed CSV quoting", () => {
  const bare = parseCsvRecords(header + "\nSYN-001,Syn\"thetic Mug,12,12,1.00,n")
  assert.equal(bare.ok, false)
  if (!bare.ok) assert.equal(bare.diagnostics[0].code, "bare_quote")

  const unclosed = parseCsvRecords(header + '\nSYN-001,"Synthetic Mug,12,12,1.00,n')
  assert.equal(unclosed.ok, false)
  if (!unclosed.ok) assert.equal(unclosed.diagnostics[0].code, "unterminated_quote")

  const trailing = parseCsvRecords(header + '\nSYN-001,"Synthetic Mug"x,12,12,1.00,n')
  assert.equal(trailing.ok, false)
  if (!trailing.ok) assert.equal(trailing.diagnostics[0].code, "characters_after_quote")
})

test("reports unknown SKU and product-name mismatch without writable sets", async () => {
  const result = await dryRunPricingMatrixCsv(
    csv(
      "UNKNOWN,Unknown,12,12,1.00,n",
      "SYN-001,Wrong Name,12,12,1.00,n",
    ),
    catalog,
  )
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.ok(result.diagnostics.some((d) => d.code === "unknown_sku"))
  assert.ok(result.diagnostics.some((d) => d.code === "product_name_mismatch"))
  assert.equal("sets" in result, false)
  assert.equal("fingerprint" in result, false)
})

test("enforces catalogue MOQ and first-tier rules", async () => {
  const mismatch = await dryRunPricingMatrixCsv(
    csv("SYN-001,Synthetic Mug,10,10,1.00,n"),
    catalog,
  )
  assert.equal(mismatch.ok, false)
  if (!mismatch.ok) {
    assert.ok(mismatch.diagnostics.some((d) => d.code === "moq_mismatch"))
  }

  const below = await dryRunPricingMatrixCsv(
    csv("SYN-001,Synthetic Mug,12,11,1.00,n"),
    catalog,
  )
  assert.equal(below.ok, false)
  if (!below.ok) {
    assert.ok(below.diagnostics.some((d) => d.code === "below_moq"))
  }

  const skipped = await dryRunPricingMatrixCsv(
    csv("SYN-001,Synthetic Mug,12,24,1.00,n"),
    catalog,
  )
  assert.equal(skipped.ok, false)
  if (!skipped.ok) {
    assert.ok(skipped.diagnostics.some((d) => d.code === "first_tier_not_moq"))
  }
})

test("rejects duplicate and non-increasing tier starts", async () => {
  const duplicate = await dryRunPricingMatrixCsv(
    csv(
      "SYN-001,Synthetic Mug,12,12,1.00,n",
      "SYN-001,Synthetic Mug,12,12,0.90,n",
    ),
    catalog,
  )
  assert.equal(duplicate.ok, false)
  if (!duplicate.ok) {
    assert.ok(duplicate.diagnostics.some((d) => d.code === "duplicate_tier_start"))
  }

  const descending = await dryRunPricingMatrixCsv(
    csv(
      "SYN-001,Synthetic Mug,12,24,0.90,n",
      "SYN-001,Synthetic Mug,12,12,1.00,n",
    ),
    catalog,
  )
  assert.equal(descending.ok, false)
  if (!descending.ok) {
    assert.ok(descending.diagnostics.some((d) => d.code === "tiers_not_increasing"))
  }
})

test("enforces PostgreSQL integer and exact USD price bounds", async () => {
  for (const start of ["0", "-1", "01", "1.5", "1e2", "2147483648"]) {
    const result = await dryRunPricingMatrixCsv(
      csv("SYN-001,Synthetic Mug,12," + start + ",1.00,n"),
      catalog,
    )
    assert.equal(result.ok, false, start)
  }

  for (const price of [
    "1",
    "0",
    "0.0000",
    "-1.00",
    "01.00",
    ".5",
    "1.",
    "1.23456",
    "1e3",
    "100000000.0000",
  ]) {
    const result = await dryRunPricingMatrixCsv(
      csv("SYN-001,Synthetic Mug,12,12," + price + ",n"),
      catalog,
    )
    assert.equal(result.ok, false, price)
  }
})

test("fingerprint ignores transport and reference-note differences", async () => {
  const a = await dryRunPricingMatrixCsv(
    csv("SYN-001,Synthetic Mug,12,12,1.0,alpha") + "\n",
    catalog,
  )
  const b = await dryRunPricingMatrixCsv(
    "\uFEFF" +
      header +
      "\r\n" +
      'SYN-001,"Synthetic Mug",12,12,1.0000,"different note"',
    catalog,
  )
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (!a.ok || !b.ok) return
  assert.equal(a.fingerprint, b.fingerprint)
  assert.equal(a.canonical, b.canonical)
})

test("fingerprint changes when effective pricing changes", async () => {
  const a = await dryRunPricingMatrixCsv(
    csv("SYN-001,Synthetic Mug,12,12,1.0000,n"),
    catalog,
  )
  const b = await dryRunPricingMatrixCsv(
    csv("SYN-001,Synthetic Mug,12,12,1.0001,n"),
    catalog,
  )
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (!a.ok || !b.ok) return
  assert.notEqual(a.fingerprint, b.fingerprint)
})

test("manual complete-set validation shares MOQ, ordering, and money rules", async () => {
  const valid = await validateTierSetDraft(catalog[0], [
    { tierStartQuantity: "12", unitPriceUsd: "2.5" },
    { tierStartQuantity: "24", unitPriceUsd: "2.0000" },
  ])
  assert.equal(valid.ok, true)
  if (valid.ok) {
    assert.equal(valid.set.tiers[0].unitPriceUsd, "2.5000")
    assert.match(valid.fingerprint, /^[0-9a-f]{64}$/)
  }

  const empty = await validateTierSetDraft(catalog[0], [])
  assert.equal(empty.ok, false)
  if (!empty.ok) {
    assert.ok(empty.diagnostics.some((d) => d.code === "empty_replacement"))
  }

  const staleShape = await validateTierSetDraft(catalog[0], [
    { tierStartQuantity: "24", unitPriceUsd: "2.00" },
    { tierStartQuantity: "12", unitPriceUsd: "2.50" },
  ])
  assert.equal(staleShape.ok, false)
  if (!staleShape.ok) {
    assert.ok(staleShape.diagnostics.some((d) => d.code === "tiers_not_increasing"))
  }
})
