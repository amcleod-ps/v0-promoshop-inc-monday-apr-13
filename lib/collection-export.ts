/**
 * Collection export serializers (Priority 4).
 *
 * A collection is exported as a "brief" the team hand-builds a Mailchimp
 * campaign from (see docs/mailchimp-export-findings.md). The server resolves a
 * collection into ExportRow[] (real product data, absolute links); these pure
 * functions turn that into each requested file format. CSV / TXT / Markdown /
 * HTML are dependency-free string builders; "Excel" ships as SpreadsheetML 2003
 * XML (opens natively in Excel/Sheets without a heavy client-side library); PDF
 * reuses the HTML through the browser's print-to-PDF.
 */

export interface ExportRow {
  name: string
  sku: string
  brand: string
  category: string
  description: string
  minQty: number
  sizes: string
  colours: string
  imageUrl: string
  link: string
}

export interface ExportPayload {
  name: string
  slug: string
  description: string
  rows: ExportRow[]
}

export type ExportFormat = "csv" | "xls" | "md" | "txt" | "html" | "pdf"

export const EXPORT_FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: "csv", label: "CSV (.csv)" },
  { format: "xls", label: "Excel (.xls)" },
  { format: "md", label: "Markdown (.md)" },
  { format: "txt", label: "Plain text (.txt)" },
  { format: "html", label: "HTML (.html)" },
  { format: "pdf", label: "PDF (print)" },
]

const COLUMNS: Array<{ key: keyof ExportRow; header: string }> = [
  { key: "name", header: "Product" },
  { key: "sku", header: "SKU" },
  { key: "brand", header: "Brand" },
  { key: "category", header: "Category" },
  { key: "description", header: "Description" },
  { key: "minQty", header: "Min Qty" },
  { key: "sizes", header: "Sizes" },
  { key: "colours", header: "Colours" },
  { key: "imageUrl", header: "Image URL" },
  { key: "link", header: "Link" },
]

function cell(row: ExportRow, key: keyof ExportRow): string {
  const v = row[key]
  return v === undefined || v === null ? "" : String(v)
}

// ---- CSV --------------------------------------------------------------------
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function buildCsv(payload: ExportPayload): string {
  const lines = [COLUMNS.map((c) => csvEscape(c.header)).join(",")]
  for (const row of payload.rows) {
    lines.push(COLUMNS.map((c) => csvEscape(cell(row, c.key))).join(","))
  }
  return lines.join("\r\n")
}

// ---- Plain text -------------------------------------------------------------
export function buildPlainText(payload: ExportPayload): string {
  const out: string[] = [payload.name.toUpperCase()]
  if (payload.description) out.push(payload.description)
  out.push("=".repeat(Math.max(payload.name.length, 8)), "")
  payload.rows.forEach((row, i) => {
    out.push(`${i + 1}. ${row.name} (${row.sku})`)
    if (row.brand) out.push(`   Brand: ${row.brand}`)
    out.push(`   Category: ${row.category}    Min qty: ${row.minQty}`)
    if (row.sizes) out.push(`   Sizes: ${row.sizes}`)
    if (row.colours) out.push(`   Colours: ${row.colours}`)
    if (row.description) out.push(`   ${row.description}`)
    if (row.imageUrl) out.push(`   Image: ${row.imageUrl}`)
    if (row.link) out.push(`   Link: ${row.link}`)
    out.push("")
  })
  return out.join("\n")
}

// ---- Markdown ---------------------------------------------------------------
function mdEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ")
}

export function buildMarkdown(payload: ExportPayload): string {
  const out: string[] = [`# ${payload.name}`, ""]
  if (payload.description) out.push(payload.description, "")
  out.push(`| ${COLUMNS.map((c) => c.header).join(" | ")} |`)
  out.push(`| ${COLUMNS.map(() => "---").join(" | ")} |`)
  for (const row of payload.rows) {
    out.push(`| ${COLUMNS.map((c) => mdEscape(cell(row, c.key))).join(" | ")} |`)
  }
  return out.join("\n")
}

// ---- HTML / PDF -------------------------------------------------------------
function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildHtml(payload: ExportPayload): string {
  const cards = payload.rows
    .map(
      (row) => `
      <article class="card">
        ${row.imageUrl ? `<img src="${htmlEscape(row.imageUrl)}" alt="${htmlEscape(row.name)}" />` : ""}
        <div class="body">
          <h2>${htmlEscape(row.name)}</h2>
          <p class="meta">${htmlEscape([row.brand, row.category].filter(Boolean).join(" · "))} · SKU ${htmlEscape(row.sku)} · Min ${row.minQty}</p>
          ${row.description ? `<p class="desc">${htmlEscape(row.description)}</p>` : ""}
          ${row.sizes ? `<p class="attr"><strong>Sizes:</strong> ${htmlEscape(row.sizes)}</p>` : ""}
          ${row.colours ? `<p class="attr"><strong>Colours:</strong> ${htmlEscape(row.colours)}</p>` : ""}
          ${row.link ? `<p class="attr"><a href="${htmlEscape(row.link)}">${htmlEscape(row.link)}</a></p>` : ""}
        </div>
      </article>`,
    )
    .join("\n")
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${htmlEscape(payload.name)} — Collection</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .intro { color: #555; margin: 0 0 24px; max-width: 60ch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
  .card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; break-inside: avoid; }
  .card img { width: 100%; height: 180px; object-fit: cover; display: block; background: #f3f3f3; }
  .card .body { padding: 14px 16px; }
  .card h2 { font-size: 16px; margin: 0 0 4px; }
  .meta { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #ef473f; margin: 0 0 8px; }
  .desc { font-size: 13px; color: #444; margin: 0 0 8px; line-height: 1.4; }
  .attr { font-size: 12px; color: #555; margin: 2px 0; }
  a { color: #1a56db; word-break: break-all; }
  @media print { body { padding: 0; } .card { border-color: #ccc; } }
</style></head>
<body>
  <h1>${htmlEscape(payload.name)}</h1>
  ${payload.description ? `<p class="intro">${htmlEscape(payload.description)}</p>` : ""}
  <div class="grid">${cards}</div>
</body></html>`
}

// ---- Excel (SpreadsheetML 2003) --------------------------------------------
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function buildExcelXml(payload: ExportPayload): string {
  const headerRow = `<Row>${COLUMNS.map((c) => `<Cell><Data ss:Type="String">${xmlEscape(c.header)}</Data></Cell>`).join("")}</Row>`
  const bodyRows = payload.rows
    .map(
      (row) =>
        `<Row>${COLUMNS.map((c) => {
          const isNum = c.key === "minQty"
          const val = cell(row, c.key)
          return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${xmlEscape(val)}</Data></Cell>`
        }).join("")}</Row>`,
    )
    .join("")
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Collection"><Table>${headerRow}${bodyRows}</Table></Worksheet>
</Workbook>`
}

// ---- Dispatcher + browser download -----------------------------------------
interface Serialized {
  content: string
  filename: string
  mime: string
}

export function serializeCollection(payload: ExportPayload, format: ExportFormat): Serialized {
  const base = payload.slug || "collection"
  switch (format) {
    case "csv":
      return { content: buildCsv(payload), filename: `${base}.csv`, mime: "text/csv;charset=utf-8" }
    case "xls":
      return { content: buildExcelXml(payload), filename: `${base}.xls`, mime: "application/vnd.ms-excel" }
    case "md":
      return { content: buildMarkdown(payload), filename: `${base}.md`, mime: "text/markdown;charset=utf-8" }
    case "txt":
      return { content: buildPlainText(payload), filename: `${base}.txt`, mime: "text/plain;charset=utf-8" }
    case "html":
    case "pdf":
      return { content: buildHtml(payload), filename: `${base}.html`, mime: "text/html;charset=utf-8" }
  }
}

/** Browser-only: download a serialized file, or open the print dialog for PDF. */
export function downloadCollection(payload: ExportPayload, format: ExportFormat): void {
  if (typeof window === "undefined") return
  const { content, filename, mime } = serializeCollection(payload, format)

  if (format === "pdf") {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(content)
    w.document.close()
    w.focus()
    // Give the images a beat to load before the print dialog opens.
    window.setTimeout(() => w.print(), 400)
    return
  }

  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
