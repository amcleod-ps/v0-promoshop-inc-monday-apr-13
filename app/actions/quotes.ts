"use server"

import { after } from "next/server"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadQuotePricingContext } from "@/lib/supabase/pricing"
import { sendQuoteNotification } from "@/lib/email/quote-notification"
import { rateLimit } from "@/lib/rate-limit"
import {
  buildQuotePricingSnapshot,
  displayedTotalMatches,
  MAX_SNAPSHOT_LINES,
} from "@/lib/pricing/snapshot"
import type { QuotePricingSnapshot } from "@/lib/pricing/types"
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
  quantity_range: z.string().trim().max(100, "Quantity is too long.").optional(),
  // 16k keeps headroom under the 20k DB CHECK (0007): /my-quote serializes
  // the whole cart into this field, and large carts are machine-generated —
  // a visitor can't "shorten" them on request.
  message: z.string().trim().min(1, "Message is required").max(16_000, "Message is too long."),
  // Honeypot — a visually hidden field real visitors never fill. Renamed
  // from "website": browser address-autofill matches that name and was a
  // silent-lead-loss risk for visitors with autofill profiles. Deliberately
  // uncapped: any value here means the submission is discarded, and a
  // length error would surface a visible failure bots could learn from.
  hp_check: z.string().optional(),
  // The cart, for server-side repricing. Note what is absent: there is no
  // unit price, tier or subtotal field anywhere in this schema, so a tampered
  // client cannot submit an amount for the server to trust — the shape of the
  // input makes price forgery impossible rather than merely detected.
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(120),
        productName: z.string().trim().max(300).optional(),
        colour: z.string().trim().max(120).optional(),
        size: z.string().trim().max(120).optional(),
        quantity: z.number().int().positive().max(1_000_000),
      }),
    )
    .max(MAX_SNAPSHOT_LINES)
    .optional(),
  // What the browser last showed the customer. Used only to detect that the
  // price moved underneath them; it never becomes the stored figure.
  displayed_total_usd: z.string().trim().max(32).optional(),
})

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>

export type QuoteSubmissionResult = {
  success: boolean
  error?: string
  /**
   * Present only when the server's recalculation disagreed with the total the
   * customer was looking at. The caller should re-render current pricing and
   * ask them to confirm; the request is deliberately not stored, because an
   * estimate nobody agreed to is not evidence of anything.
   */
  status?: "review_required"
  pricing?: QuotePricingSnapshot
}

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

interface RecalculatedPricing {
  readonly snapshot: QuotePricingSnapshot
  readonly reviewRequired: boolean
}

/**
 * Recalculates the whole cart from current database state.
 *
 * Returns null — meaning "store this quote the way quotes have always been
 * stored" — whenever pricing cannot be established: the feature is off, the
 * cart carried no items, the database is unreachable, or the cart is
 * malformed. That is the normal state today and stays the safe one: an
 * unpriced quote request is the product's existing, working behaviour, so
 * nothing here may turn a pricing problem into a lost enquiry.
 */
async function recalculatePricing(
  validated: QuoteRequestInput,
): Promise<RecalculatedPricing | null> {
  const items = validated.items
  if (!items || items.length === 0) return null

  const context = await loadQuotePricingContext(items.map((item) => item.sku))

  if (context.status === "disabled") return null

  if (context.status === "unavailable") {
    console.error(
      "quote_requests: pricing context unavailable — quote stored without a pricing snapshot.",
    )
    return null
  }

  const result = buildQuotePricingSnapshot(
    items,
    context.products,
    context.tiers,
    new Date().toISOString(),
  )

  if (result.status !== "built") {
    console.error(
      `quote_requests: pricing snapshot not built (${result.reason}) — quote stored without one.`,
    )
    return null
  }

  const { snapshot } = result

  // Nothing priced means there is no estimate to disagree about, so an
  // unpriced cart is never held back for review.
  const reviewRequired =
    snapshot.estimatedTotalUsd !== null &&
    !displayedTotalMatches(snapshot, validated.displayed_total_usd)

  return { snapshot, reviewRequired }
}

export async function submitQuoteRequest(
  input: QuoteRequestInput
): Promise<QuoteSubmissionResult> {
  try {
    const validated = quoteRequestSchema.parse(input)

    // Bots that fill the honeypot get a success response (so they don't
    // adapt) but nothing is stored or sent.
    if (validated.hp_check) {
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

    // With the Supabase env vars unset/misconfigured this throws — caught
    // below as a generic failure for the visitor, but logged loudly first:
    // every OTHER feature falls back silently to static content, so a
    // misconfigured deploy looks healthy while the only server-persisted
    // conversion flow is down.
    let supabase
    try {
      supabase = await createClient()
    } catch (e) {
      console.error(
        "quote_requests: Supabase client init failed — NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing or invalid. Quote submissions are NOT being stored.",
        e,
      )
      return { success: false, error: "Failed to submit quote request. Please try again." }
    }

    // Reprice from the database before anything is written. Returns null
    // whenever pricing is off or unavailable, which is the normal state until
    // the feature is released — the quote then follows the original,
    // unpriced path exactly as before.
    const pricing = await recalculatePricing(validated)

    if (pricing?.reviewRequired) {
      return {
        success: false,
        status: "review_required",
        pricing: pricing.snapshot,
      }
    }

    const snapshot = pricing?.snapshot ?? null
    const row = {
      first_name: validated.first_name,
      last_name: validated.last_name,
      email: validated.email,
      phone: validated.phone || null,
      company: validated.company || null,
      quantity_range: validated.quantity_range || null,
      message: validated.message,
      status: "new",
    }

    // A verified snapshot can only be written by a BYPASSRLS role: migration
    // 0014 pins the column to NULL for anon and authenticated. Unpriced
    // requests keep using the anon client so that the public quote form has
    // no new dependency on the service-role key.
    let error

    if (snapshot) {
      try {
        const admin = createAdminClient()
        ;({ error } = await admin
          .from("quote_requests")
          .insert({ ...row, pricing_snapshot: snapshot }))
      } catch (adminError) {
        // Losing the lead is worse than losing the estimate. Store the
        // request through the ordinary path and make the gap loud, because
        // the pricing evidence for this quote will be missing.
        console.error(
          "quote_requests: SUPABASE_SERVICE_ROLE_KEY missing or invalid — quote stored WITHOUT its pricing snapshot.",
          adminError,
        )
        ;({ error } = await supabase.from("quote_requests").insert(row))
      }
    } else {
      ;({ error } = await supabase.from("quote_requests").insert(row))
    }

    if (error) {
      console.error("Error submitting quote request:", error)
      return { success: false, error: "Failed to submit quote request. Please try again." }
    }

    // Staff notification runs after the response is sent, so a slow or
    // failing Resend call never delays or fails the visitor's submission.
    after(() => sendQuoteNotification({ ...validated, pricing: snapshot }))

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: "An unexpected error occurred." }
  }
}
