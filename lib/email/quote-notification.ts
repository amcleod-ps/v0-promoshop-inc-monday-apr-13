import "server-only"

import type {
  QuotePricingSnapshot,
  SnapshotSkuStatus,
} from "@/lib/pricing/types"

/**
 * Best-effort "new quote request" notification, sent through Resend's REST
 * API (https://resend.com/docs/api-reference/emails/send-email) with a plain
 * fetch — no SDK dependency.
 *
 * Follows the same defensive contract as the lib/supabase/* getters: when the
 * env vars are unset (Resend not connected yet) or the send fails, log and
 * return. The quote_requests row written by submitQuoteRequest is the source
 * of truth; a notification problem must never fail the visitor's submission.
 *
 * Env vars (all server-only — see .env.example and docs/RESEND-EMAIL-SETUP.md):
 *   RESEND_API_KEY           — enables sending when present
 *   QUOTE_NOTIFICATION_EMAIL — recipient address(es), comma-separated
 *   QUOTE_NOTIFICATION_FROM  — optional sender; defaults to Resend's test
 *                              sender, which only delivers to the Resend
 *                              account owner's own address
 */

interface QuoteNotificationFields {
  first_name: string
  last_name: string
  email: string
  phone?: string
  company?: string
  quantity_range?: string
  message: string
  /**
   * The server's own calculation, as stored on the request. Null for the
   * unpriced flow. Never taken from the browser, so what staff read here is
   * the same evidence a reviewer will find in quote_requests.
   */
  pricing?: QuotePricingSnapshot | null
}

// Zod only trims the ends of each field — embedded newlines survive, and a
// newline in an email subject makes Resend reject the send (silently losing
// the staff notification).
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}

const SKU_STATUS_LABEL: Record<SnapshotSkuStatus, string> = {
  priced: "priced",
  below_moq: "below minimum order quantity — no price",
  no_tiers: "no pricing loaded — no price",
  unknown_sku: "SKU not found in the catalogue — no price",
  inactive_sku: "product retired since the cart was built — no price",
  invalid_tiers: "pricing data failed validation — no price",
}

/**
 * Renders the stored estimate as plain text for the staff email.
 *
 * Unpriced SKUs are listed with their reason rather than omitted: a
 * notification that quietly drops an item the customer asked about is how a
 * request gets quoted incompletely.
 */
function pricingLines(
  pricing: QuotePricingSnapshot | null | undefined,
): string[] {
  if (!pricing || pricing.skus.length === 0) return []

  const lines = ["", "Estimated pricing (calculated by the server):"]

  for (const sku of pricing.skus) {
    const variants = sku.lines
      .map((line) =>
        [line.colour, line.size].filter(Boolean).join(" / ") ||
        "no variant specified",
      )
      .join("; ")

    lines.push(
      `- ${singleLine(sku.productName ?? sku.sku)} (${singleLine(sku.sku)})`,
      `    quantity ${sku.aggregatedQuantity} across: ${singleLine(variants)}`,
    )

    if (sku.status === "priced") {
      lines.push(
        `    tier from ${sku.tierStartQuantity} @ USD ${sku.unitPriceUsd} = USD ${sku.subtotalUsd}`,
      )
    } else {
      const minimum =
        sku.status === "below_moq" && sku.minimumQuantity !== null
          ? ` (minimum ${sku.minimumQuantity})`
          : ""
      lines.push(`    ${SKU_STATUS_LABEL[sku.status]}${minimum}`)
    }
  }

  lines.push(
    "",
    pricing.estimatedTotalUsd === null
      ? "Estimated product subtotal: none of these items could be priced."
      : `Estimated product subtotal: USD ${pricing.estimatedTotalUsd}`,
  )

  if (pricing.unpricedSkuCount > 0 && pricing.estimatedTotalUsd !== null) {
    lines.push(
      `This subtotal covers ${pricing.pricedSkuCount} of ${pricing.skus.length} products; the rest are listed above without a price.`,
    )
  }

  lines.push(
    "This is an estimate for the product lines only, calculated at " +
      `${singleLine(pricing.calculatedAt)}. It is not a quotation and excludes any charge not shown above.`,
  )

  return lines
}

export async function sendQuoteNotification(
  quote: QuoteNotificationFields
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const recipients = (process.env.QUOTE_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean)
  if (!apiKey || recipients.length === 0) return

  const from =
    process.env.QUOTE_NOTIFICATION_FROM?.trim() ||
    "PromoShop Website <onboarding@resend.dev>"
  // Collapse newlines in every interpolated field. Zod only trims the ends,
  // so an embedded newline in email/phone/company survives — and `email`
  // becomes the `reply_to` header at Resend, where a stray newline is a
  // header-injection foothold. `message` stays multi-line on purpose (it's
  // the serialized cart, meant to be read as a block in the body).
  const name = singleLine(`${quote.first_name} ${quote.last_name}`)
  const email = singleLine(quote.email)
  const phone = quote.phone ? singleLine(quote.phone) : null
  const company = quote.company ? singleLine(quote.company) : null
  const quantity = quote.quantity_range ? singleLine(quote.quantity_range) : null
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    company ? `Company: ${company}` : null,
    quantity ? `Quantity range: ${quantity}` : null,
    "",
    "Message:",
    quote.message,
    ...pricingLines(quote.pricing),
    "",
    "--",
    "Sent by the PromoShop website. Every request is also saved in Supabase (Table Editor → quote_requests).",
  ]
    .filter((line): line is string => line !== null)
    .join("\n")

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        reply_to: email,
        subject: `New quote request from ${name}${company ? ` (${company})` : ""}`,
        text: body,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error(
        "Quote notification email failed:",
        res.status,
        await res.text()
      )
    }
  } catch (err) {
    console.error("Quote notification email failed:", err)
  }
}
