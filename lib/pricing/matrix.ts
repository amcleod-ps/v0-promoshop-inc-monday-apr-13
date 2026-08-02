import { normalizeUnitPriceUsd } from "./money"

export const PRICING_MATRIX_HEADER = [
  "sku",
  "product_name",
  "min_order_quantity",
  "tier_start_quantity",
  "unit_price_usd",
  "notes",
] as const

export const PRICING_MATRIX_LIMITS = {
  maxUtf8Bytes: 1_048_576,
  maxDataRows: 10_000,
  maxFieldCharacters: 5_000,
  maxTiersPerSku: 1_000,
} as const

const MAX_INT4 = 2_147_483_647
const POSITIVE_INTEGER = /^[1-9]\d*$/
const PRICE_INPUT = /^(0|[1-9]\d*)\.\d{1,4}$/

export type PricingMatrixField = (typeof PRICING_MATRIX_HEADER)[number]

export interface PricingCatalogProduct {
  sku: string
  name: string
  minimumQuantity: number
}

export interface TierDraft {
  tierStartQuantity: string
  unitPriceUsd: string
}

export interface CanonicalTier {
  tierStartQuantity: number
  unitPriceUsd: string
}

export interface CanonicalTierSet {
  sku: string
  productName: string
  minimumQuantity: number
  tiers: CanonicalTier[]
}

export interface MatrixDiagnostic {
  severity: "error"
  code: string
  message: string
  record?: number
  line?: number
  field?: PricingMatrixField
  relatedRecord?: number
}

interface CsvRecord {
  fields: string[]
  record: number
  line: number
}

type CsvParseResult =
  | { ok: true; records: CsvRecord[] }
  | { ok: false; diagnostics: MatrixDiagnostic[] }

export type PricingMatrixDryRun =
  | {
      ok: true
      sets: CanonicalTierSet[]
      rowCount: number
      skuCount: number
      canonical: string
      fingerprint: string
      diagnostics: MatrixDiagnostic[]
    }
  | {
      ok: false
      rowCount: number
      diagnostics: MatrixDiagnostic[]
    }

export type TierSetDraftValidation =
  | {
      ok: true
      set: CanonicalTierSet
      fingerprint: string
      diagnostics: MatrixDiagnostic[]
    }
  | {
      ok: false
      diagnostics: MatrixDiagnostic[]
    }

function diagnostic(
  code: string,
  message: string,
  details: Omit<MatrixDiagnostic, "severity" | "code" | "message"> = {},
): MatrixDiagnostic {
  return { severity: "error", code, message, ...details }
}

function compareSku(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function isLineBreak(source: string, index: number): number {
  if (source[index] === "\n") return 1
  if (source[index] === "\r") return source[index + 1] === "\n" ? 2 : 1
  return 0
}

/**
 * Strict, allocation-bounded CSV reader for the Stage 2 matrix. It supports
 * RFC-style quoted fields, escaped quotes, embedded newlines, CRLF/LF, and one
 * leading UTF-8 BOM. Structural errors stop semantic validation because field
 * boundaries are no longer trustworthy.
 */
export function parseCsvRecords(input: string): CsvParseResult {
  if (new TextEncoder().encode(input).byteLength > PRICING_MATRIX_LIMITS.maxUtf8Bytes) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "file_too_large",
          "The CSV exceeds the 1 MiB import limit.",
        ),
      ],
    }
  }

  const source = input.startsWith("\uFEFF") ? input.slice(1) : input
  if (source.includes("\0")) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("nul_character", "The CSV contains a NUL character."),
      ],
    }
  }

  const records: CsvRecord[] = []
  const diagnostics: MatrixDiagnostic[] = []
  let fields: string[] = []
  let field = ""
  let fieldStarted = false
  let inQuotes = false
  let afterQuote = false
  let line = 1
  let recordLine = 1
  let fieldTooLongReported = false

  const append = (value: string) => {
    field += value
    fieldStarted = true
    if (
      field.length > PRICING_MATRIX_LIMITS.maxFieldCharacters &&
      !fieldTooLongReported
    ) {
      diagnostics.push(
        diagnostic(
          "field_too_long",
          "A field exceeds the 5,000-character limit.",
          { record: records.length + 1, line: recordLine },
        ),
      )
      fieldTooLongReported = true
    }
  }

  const finishField = () => {
    fields.push(field)
    field = ""
    fieldStarted = false
    inQuotes = false
    afterQuote = false
    fieldTooLongReported = false
  }

  const finishRecord = () => {
    finishField()
    records.push({
      fields,
      record: records.length + 1,
      line: recordLine,
    })
    fields = []
    recordLine = line
  }

  let index = 0
  while (index < source.length) {
    const char = source[index]
    const breakLength = isLineBreak(source, index)

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          append('"')
          index += 2
          continue
        }
        inQuotes = false
        afterQuote = true
        index += 1
        continue
      }
      if (breakLength > 0) {
        append("\n")
        line += 1
        index += breakLength
        continue
      }
      append(char)
      index += 1
      continue
    }

    if (afterQuote) {
      if (char === ",") {
        finishField()
        index += 1
        continue
      }
      if (breakLength > 0) {
        line += 1
        index += breakLength
        finishRecord()
        recordLine = line
        continue
      }
      diagnostics.push(
        diagnostic(
          "characters_after_quote",
          "Only a comma or line ending may follow a closing quote.",
          { record: records.length + 1, line },
        ),
      )
      return { ok: false, diagnostics }
    }

    if (char === '"') {
      if (fieldStarted || field.length > 0) {
        diagnostics.push(
          diagnostic(
            "bare_quote",
            "A quote is only valid at the start of a quoted field.",
            { record: records.length + 1, line },
          ),
        )
        return { ok: false, diagnostics }
      }
      fieldStarted = true
      inQuotes = true
      index += 1
      continue
    }

    if (char === ",") {
      finishField()
      index += 1
      continue
    }

    if (breakLength > 0) {
      line += 1
      index += breakLength
      finishRecord()
      recordLine = line
      if (records.length > PRICING_MATRIX_LIMITS.maxDataRows + 1) {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              "too_many_rows",
              "The CSV exceeds the 10,000-row import limit.",
            ),
          ],
        }
      }
      continue
    }

    append(char)
    index += 1
  }

  if (inQuotes) {
    return {
      ok: false,
      diagnostics: [
        ...diagnostics,
        diagnostic(
          "unterminated_quote",
          "A quoted field is not closed.",
          { record: records.length + 1, line: recordLine },
        ),
      ],
    }
  }

  if (fieldStarted || field.length > 0 || fields.length > 0 || afterQuote) {
    finishRecord()
  }

  if (records.length > PRICING_MATRIX_LIMITS.maxDataRows + 1) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "too_many_rows",
          "The CSV exceeds the 10,000-row import limit.",
        ),
      ],
    }
  }

  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, records }
}

function parsePositiveInt4(value: string): number | null {
  if (!POSITIVE_INTEGER.test(value)) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > MAX_INT4) return null
  return parsed
}

function validateCatalog(
  catalog: readonly PricingCatalogProduct[],
): {
  products: Map<string, PricingCatalogProduct>
  diagnostics: MatrixDiagnostic[]
} {
  const products = new Map<string, PricingCatalogProduct>()
  const diagnostics: MatrixDiagnostic[] = []

  for (const product of catalog) {
    if (
      !product.sku ||
      product.sku !== product.sku.trim() ||
      !Number.isInteger(product.minimumQuantity) ||
      product.minimumQuantity <= 0 ||
      product.minimumQuantity > MAX_INT4
    ) {
      diagnostics.push(
        diagnostic(
          "invalid_catalog",
          "The live product catalogue contains an invalid SKU or MOQ.",
        ),
      )
      continue
    }
    if (products.has(product.sku)) {
      diagnostics.push(
        diagnostic(
          "duplicate_catalog_sku",
          "The live product catalogue contains a duplicate SKU.",
        ),
      )
      continue
    }
    products.set(product.sku, product)
  }

  return { products, diagnostics }
}

interface ValidRow {
  record: number
  line: number
  sku: string
  product: PricingCatalogProduct
  tierStartQuantity: number
  unitPriceUsd: string
}

function validateRows(
  records: CsvRecord[],
  catalog: readonly PricingCatalogProduct[],
): {
  rows: ValidRow[]
  sets: CanonicalTierSet[]
  diagnostics: MatrixDiagnostic[]
} {
  const catalogResult = validateCatalog(catalog)
  const diagnostics = [...catalogResult.diagnostics]
  const rows: ValidRow[] = []

  if (records.length === 0) {
    return {
      rows,
      sets: [],
      diagnostics: [
        ...diagnostics,
        diagnostic("empty_file", "The CSV is empty."),
      ],
    }
  }

  const header = records[0]
  const headerMatches =
    header.fields.length === PRICING_MATRIX_HEADER.length &&
    header.fields.every((value, index) => value === PRICING_MATRIX_HEADER[index])

  if (!headerMatches) {
    diagnostics.push(
      diagnostic(
        "invalid_header",
        "The header must exactly match the six-column pricing matrix template.",
        { record: 1, line: header.line },
      ),
    )
  }

  if (records.length === 1) {
    diagnostics.push(
      diagnostic(
        "no_data_rows",
        "The CSV contains a header but no pricing rows.",
        { record: 1, line: header.line },
      ),
    )
  }

  for (const sourceRow of records.slice(1)) {
    if (sourceRow.fields.every((value) => value.trim() === "")) {
      diagnostics.push(
        diagnostic(
          "blank_row",
          "Blank rows are not allowed in the pricing matrix.",
          { record: sourceRow.record, line: sourceRow.line },
        ),
      )
      continue
    }

    if (sourceRow.fields.length !== PRICING_MATRIX_HEADER.length) {
      diagnostics.push(
        diagnostic(
          "wrong_column_count",
          "This row does not contain exactly six columns.",
          { record: sourceRow.record, line: sourceRow.line },
        ),
      )
      continue
    }

    const values = sourceRow.fields.map((value) => value.trim())
    const [sku, productName, minimumQuantityRaw, tierStartRaw, priceRaw] = values
    let valid = true

    const required: Array<[PricingMatrixField, string]> = [
      ["sku", sku],
      ["product_name", productName],
      ["min_order_quantity", minimumQuantityRaw],
      ["tier_start_quantity", tierStartRaw],
      ["unit_price_usd", priceRaw],
    ]
    for (const [fieldName, value] of required) {
      if (!value) {
        diagnostics.push(
          diagnostic(
            "required",
            "This required field is blank.",
            {
              record: sourceRow.record,
              line: sourceRow.line,
              field: fieldName,
            },
          ),
        )
        valid = false
      }
    }

    const product = catalogResult.products.get(sku)
    if (sku && !product) {
      diagnostics.push(
        diagnostic(
          "unknown_sku",
          "The SKU does not exactly match an active catalogue product.",
          {
            record: sourceRow.record,
            line: sourceRow.line,
            field: "sku",
          },
        ),
      )
      valid = false
    }

    if (product && productName && productName !== product.name.trim()) {
      diagnostics.push(
        diagnostic(
          "product_name_mismatch",
          "The reference product name does not match the current catalogue name.",
          {
            record: sourceRow.record,
            line: sourceRow.line,
            field: "product_name",
          },
        ),
      )
      valid = false
    }

    const minimumQuantity = parsePositiveInt4(minimumQuantityRaw)
    if (minimumQuantityRaw && minimumQuantity === null) {
      diagnostics.push(
        diagnostic(
          "invalid_integer",
          "MOQ must be a positive whole number within the database limit.",
          {
            record: sourceRow.record,
            line: sourceRow.line,
            field: "min_order_quantity",
          },
        ),
      )
      valid = false
    } else if (
      product &&
      minimumQuantity !== null &&
      minimumQuantity !== product.minimumQuantity
    ) {
      diagnostics.push(
        diagnostic(
          "moq_mismatch",
          "The CSV MOQ does not match the current catalogue MOQ.",
          {
            record: sourceRow.record,
            line: sourceRow.line,
            field: "min_order_quantity",
          },
        ),
      )
      valid = false
    }

    const tierStartQuantity = parsePositiveInt4(tierStartRaw)
    if (tierStartRaw && tierStartQuantity === null) {
      diagnostics.push(
        diagnostic(
          "invalid_integer",
          "Tier start must be a positive whole number within the database limit.",
          {
            record: sourceRow.record,
            line: sourceRow.line,
            field: "tier_start_quantity",
          },
        ),
      )
      valid = false
    } else if (
      minimumQuantity !== null &&
      tierStartQuantity !== null &&
      tierStartQuantity < minimumQuantity
    ) {
      diagnostics.push(
        diagnostic(
          "below_moq",
          "Tier start cannot be below the product MOQ.",
          {
            record: sourceRow.record,
            line: sourceRow.line,
            field: "tier_start_quantity",
          },
        ),
      )
      valid = false
    }

    const unitPriceUsd =
      PRICE_INPUT.test(priceRaw) ? normalizeUnitPriceUsd(priceRaw) : null
    if (priceRaw && unitPriceUsd === null) {
      diagnostics.push(
        diagnostic(
          "invalid_price",
          "Unit price must be a positive USD decimal with one to four decimal places.",
          {
            record: sourceRow.record,
            line: sourceRow.line,
            field: "unit_price_usd",
          },
        ),
      )
      valid = false
    }

    if (
      valid &&
      product &&
      minimumQuantity !== null &&
      tierStartQuantity !== null &&
      unitPriceUsd !== null
    ) {
      rows.push({
        record: sourceRow.record,
        line: sourceRow.line,
        sku,
        product,
        tierStartQuantity,
        unitPriceUsd,
      })
    }
  }

  const grouped = new Map<string, ValidRow[]>()
  for (const row of rows) {
    const group = grouped.get(row.sku) ?? []
    group.push(row)
    grouped.set(row.sku, group)
  }

  const sets: CanonicalTierSet[] = []
  for (const [sku, group] of grouped) {
    if (group.length > PRICING_MATRIX_LIMITS.maxTiersPerSku) {
      diagnostics.push(
        diagnostic(
          "too_many_tiers",
          "A SKU exceeds the 1,000-tier limit.",
          { record: group[0]?.record, field: "tier_start_quantity" },
        ),
      )
      continue
    }

    const seen = new Map<number, number>()
    let previousStart: number | null = null
    for (const row of group) {
      const firstRecord = seen.get(row.tierStartQuantity)
      if (firstRecord !== undefined) {
        diagnostics.push(
          diagnostic(
            "duplicate_tier_start",
            "This SKU and tier-start pair is duplicated.",
            {
              record: row.record,
              line: row.line,
              field: "tier_start_quantity",
              relatedRecord: firstRecord,
            },
          ),
        )
      } else {
        seen.set(row.tierStartQuantity, row.record)
      }

      if (previousStart !== null && row.tierStartQuantity <= previousStart) {
        diagnostics.push(
          diagnostic(
            "tiers_not_increasing",
            "Tier starts must be strictly increasing for each SKU.",
            {
              record: row.record,
              line: row.line,
              field: "tier_start_quantity",
            },
          ),
        )
      }
      previousStart = row.tierStartQuantity
    }

    const sorted = group.slice().sort(
      (a, b) => a.tierStartQuantity - b.tierStartQuantity,
    )
    if (
      sorted.length > 0 &&
      sorted[0].tierStartQuantity !== sorted[0].product.minimumQuantity
    ) {
      diagnostics.push(
        diagnostic(
          "first_tier_not_moq",
          "The first tier must start at the current product MOQ.",
          {
            record: sorted[0].record,
            line: sorted[0].line,
            field: "tier_start_quantity",
          },
        ),
      )
    }

    sets.push({
      sku,
      productName: group[0].product.name,
      minimumQuantity: group[0].product.minimumQuantity,
      tiers: sorted.map((row) => ({
        tierStartQuantity: row.tierStartQuantity,
        unitPriceUsd: row.unitPriceUsd,
      })),
    })
  }

  sets.sort((a, b) => compareSku(a.sku, b.sku))
  return { rows, sets, diagnostics }
}

export function canonicalizePricingMatrix(
  sets: readonly CanonicalTierSet[],
): string {
  const canonicalSets = sets
    .slice()
    .sort((a, b) => compareSku(a.sku, b.sku))
    .map((set) => [
      set.sku,
      set.minimumQuantity,
      set.tiers
        .slice()
        .sort((a, b) => a.tierStartQuantity - b.tierStartQuantity)
        .map((tier) => [tier.tierStartQuantity, tier.unitPriceUsd]),
    ])

  return "pricing-matrix:v1\n" + JSON.stringify(canonicalSets) + "\n"
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function fingerprintPricingMatrix(
  sets: readonly CanonicalTierSet[],
): Promise<string> {
  return sha256Hex(canonicalizePricingMatrix(sets))
}

export async function dryRunPricingMatrixCsv(
  csv: string,
  catalog: readonly PricingCatalogProduct[],
): Promise<PricingMatrixDryRun> {
  const parsed = parseCsvRecords(csv)
  if (!parsed.ok) {
    return { ok: false, rowCount: 0, diagnostics: parsed.diagnostics }
  }

  const validated = validateRows(parsed.records, catalog)
  const rowCount = Math.max(0, parsed.records.length - 1)
  if (validated.diagnostics.length > 0) {
    return {
      ok: false,
      rowCount,
      diagnostics: validated.diagnostics,
    }
  }

  const canonical = canonicalizePricingMatrix(validated.sets)
  return {
    ok: true,
    sets: validated.sets,
    rowCount,
    skuCount: validated.sets.length,
    canonical,
    fingerprint: await sha256Hex(canonical),
    diagnostics: [],
  }
}

export async function validateTierSetDraft(
  product: PricingCatalogProduct,
  tiers: readonly TierDraft[],
): Promise<TierSetDraftValidation> {
  const diagnostics: MatrixDiagnostic[] = []
  if (
    !product.sku ||
    product.sku !== product.sku.trim() ||
    !Number.isInteger(product.minimumQuantity) ||
    product.minimumQuantity <= 0 ||
    product.minimumQuantity > MAX_INT4
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "invalid_catalog",
          "The live product catalogue contains an invalid SKU or MOQ.",
        ),
      ],
    }
  }

  if (tiers.length === 0) {
    diagnostics.push(
      diagnostic(
        "empty_replacement",
        "A replacement must contain at least one tier. Use Retire to remove a complete set.",
      ),
    )
  }
  if (tiers.length > PRICING_MATRIX_LIMITS.maxTiersPerSku) {
    diagnostics.push(
      diagnostic("too_many_tiers", "A SKU exceeds the 1,000-tier limit."),
    )
  }

  const canonicalTiers: CanonicalTier[] = []
  const seen = new Set<number>()
  let previousStart: number | null = null

  for (let index = 0; index < tiers.length; index += 1) {
    const draft = tiers[index]
    const record = index + 1
    const startRaw =
      typeof draft?.tierStartQuantity === "string"
        ? draft.tierStartQuantity.trim()
        : ""
    const priceRaw =
      typeof draft?.unitPriceUsd === "string"
        ? draft.unitPriceUsd.trim()
        : ""

    const start = parsePositiveInt4(startRaw)
    if (start === null) {
      diagnostics.push(
        diagnostic(
          "invalid_integer",
          "Tier start must be a positive whole number within the database limit.",
          { record, field: "tier_start_quantity" },
        ),
      )
    } else {
      if (start < product.minimumQuantity) {
        diagnostics.push(
          diagnostic(
            "below_moq",
            "Tier start cannot be below the product MOQ.",
            { record, field: "tier_start_quantity" },
          ),
        )
      }
      if (seen.has(start)) {
        diagnostics.push(
          diagnostic(
            "duplicate_tier_start",
            "Tier starts must be unique.",
            { record, field: "tier_start_quantity" },
          ),
        )
      }
      if (previousStart !== null && start <= previousStart) {
        diagnostics.push(
          diagnostic(
            "tiers_not_increasing",
            "Tier starts must be strictly increasing.",
            { record, field: "tier_start_quantity" },
          ),
        )
      }
      seen.add(start)
      previousStart = start
    }

    const price =
      PRICE_INPUT.test(priceRaw) ? normalizeUnitPriceUsd(priceRaw) : null
    if (price === null) {
      diagnostics.push(
        diagnostic(
          "invalid_price",
          "Unit price must be a positive USD decimal with one to four decimal places.",
          { record, field: "unit_price_usd" },
        ),
      )
    }

    if (start !== null && price !== null) {
      canonicalTiers.push({
        tierStartQuantity: start,
        unitPriceUsd: price,
      })
    }
  }

  if (
    canonicalTiers.length > 0 &&
    canonicalTiers[0].tierStartQuantity !== product.minimumQuantity
  ) {
    diagnostics.push(
      diagnostic(
        "first_tier_not_moq",
        "The first tier must start at the current product MOQ.",
        { record: 1, field: "tier_start_quantity" },
      ),
    )
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics }

  const set: CanonicalTierSet = {
    sku: product.sku,
    productName: product.name,
    minimumQuantity: product.minimumQuantity,
    tiers: canonicalTiers,
  }

  return {
    ok: true,
    set,
    fingerprint: await fingerprintPricingMatrix([set]),
    diagnostics: [],
  }
}
