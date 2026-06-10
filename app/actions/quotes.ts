"use server"

import { after } from "next/server"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { sendQuoteNotification } from "@/lib/email/quote-notification"
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"

// Length caps matter here: serverActions.bodySizeLimit is raised to 10 MB
// for the admin image uploader, and that limit is global — without caps
// anyone could pump multi-megabyte strings into quote_requests. Migration
// 0007 adds matching (looser) CHECK constraints at the DB layer for inserts
// that bypass this action via the PostgREST API.
const quoteRequestSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100, "First name is too long."),
  last_name: z.string().trim().min(1, "Last name is required").max(100, "Last name is too long."),
  email: z.string().trim().email("Invalid email address").max(254, "Email address is too long."),
  phone: z.string().trim().max(50, "Phone number is too long.").optional(),
  company: z.string().trim().max(200, "Company name is too long.").optional(),
  brand_interest: z.string().trim().max(200, "Brand interest is too long.").optional(),
  quantity_range: z.string().trim().max(100, "Quantity is too long.").optional(),
  message: z.string().trim().min(1, "Message is required").max(10_000, "Message is too long (10,000 character limit)."),
  // Honeypot — a visually hidden "website" field real visitors never fill.
  website: z.string().max(500).optional(),
})

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

export async function submitQuoteRequest(
  input: QuoteRequestInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = quoteRequestSchema.parse(input)

    // Bots that fill the honeypot get a success response (so they don't
    // adapt) but nothing is stored or sent.
    if (validated.website) {
      console.warn("quote_requests: honeypot tripped, submission discarded")
      return { success: true }
    }

    // Best-effort throttle, keyed by client IP (first x-forwarded-for hop —
    // Vercel sets it). Fails open when the header is absent (e.g. local dev)
    // so a proxyless deployment can't lock every visitor into one bucket.
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim()
    if (ip && !rateLimit(`quote:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return {
        success: false,
        error: "Too many quote requests from your network. Please wait a few minutes and try again.",
      }
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from("quote_requests")
      .insert({
        first_name: validated.first_name,
        last_name: validated.last_name,
        email: validated.email,
        phone: validated.phone || null,
        company: validated.company || null,
        brand_interest: validated.brand_interest || null,
        quantity_range: validated.quantity_range || null,
        message: validated.message,
        status: "new",
      })

    if (error) {
      console.error("Error submitting quote request:", error)
      return { success: false, error: "Failed to submit quote request. Please try again." }
    }

    // Staff notification runs after the response is sent, so a slow or
    // failing Resend call never delays or fails the visitor's submission.
    after(() => sendQuoteNotification(validated))

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: "An unexpected error occurred." }
  }
}
