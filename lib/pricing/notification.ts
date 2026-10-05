import { snapshotPricingTotals } from "./snapshot"
import { pricingTotalEntries } from "./source"
import type { QuotePricingSnapshot, SnapshotSkuStatus } from "./types"

const SKU_STATUS_LABEL: Record<SnapshotSkuStatus, string> = {
  priced: "priced",
  below_moq: "below minimum order quantity — no price",
  no_tiers: "no pricing loaded — no price",
  unknown_sku: "SKU not found in the catalogue — no price",
  inactive_sku: "product retired since the cart was built — no price",
  invalid_tiers: "pricing data failed validation — no price",
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}

/** Read both saved USD snapshots and new snapshots with separate currencies. */
export function pricingNotificationLines(
  pricing: QuotePricingSnapshot | null | undefined,
): string[] {
  if (!pricing || pricing.skus.length === 0) return []
  const lines = ["", "Estimated pricing (calculated by the server):"]

  for (const sku of pricing.skus) {
    const variants = sku.lines
      .map((line) => [line.colour, line.size].filter(Boolean).join(" / ") || "no variant specified")
      .join("; ")
    lines.push(
      `- ${singleLine(sku.productName ?? sku.sku)} (${singleLine(sku.sku)})`,
      `    quantity ${sku.aggregatedQuantity} across: ${singleLine(variants)}`,
    )

    if (sku.status === "priced") {
      const currency = pricing.version === 1 ? "USD" : sku.currency
      const unitPrice = pricing.version === 1 ? sku.unitPriceUsd : sku.unitPrice
      const subtotal = pricing.version === 1 ? sku.subtotalUsd : sku.subtotal
      lines.push(`    tier from ${sku.tierStartQuantity} @ ${currency} ${unitPrice} = ${currency} ${subtotal}`)
    } else {
      const minimum = sku.status === "below_moq" && sku.minimumQuantity !== null
        ? ` (minimum ${sku.minimumQuantity})` : ""
      lines.push(`    ${SKU_STATUS_LABEL[sku.status]}${minimum}`)
    }
  }

  const totals = pricingTotalEntries(snapshotPricingTotals(pricing))
  lines.push("")
  if (totals.length === 0) {
    lines.push("Estimated product subtotal: none of these items could be priced.")
  } else {
    for (const [currency, total] of totals) {
      lines.push(`Estimated product subtotal: ${currency} ${total}`)
    }
    if (totals.length > 1) lines.push("CAD and USD subtotals are separate. The website does not convert currencies.")
  }
  if (pricing.unpricedSkuCount > 0 && totals.length > 0) {
    lines.push(`These subtotals cover ${pricing.pricedSkuCount} of ${pricing.skus.length} products. The other products have no price.`)
  }
  lines.push(
    "This is an estimate for the product lines only, calculated at " +
      `${singleLine(pricing.calculatedAt)}. It is not a quotation and excludes any charge not shown above.`,
  )
  return lines
}
