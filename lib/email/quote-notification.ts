import "server-only"

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
}

// Zod only trims the ends of each field — embedded newlines survive, and a
// newline in an email subject makes Resend reject the send (silently losing
// the staff notification).
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
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
  const name = singleLine(`${quote.first_name} ${quote.last_name}`)
  const body = [
    `Name: ${name}`,
    `Email: ${quote.email}`,
    quote.phone ? `Phone: ${quote.phone}` : null,
    quote.company ? `Company: ${quote.company}` : null,
    quote.quantity_range ? `Quantity range: ${quote.quantity_range}` : null,
    "",
    "Message:",
    quote.message,
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
        reply_to: quote.email,
        subject: `New quote request from ${name}${quote.company ? ` (${singleLine(quote.company)})` : ""}`,
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
