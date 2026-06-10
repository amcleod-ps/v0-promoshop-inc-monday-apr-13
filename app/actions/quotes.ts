"use server"

import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendQuoteNotification } from "@/lib/email/quote-notification"
import { z } from "zod"

const quoteRequestSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  brand_interest: z.string().optional(),
  quantity_range: z.string().optional(),
  message: z.string().min(1, "Message is required"),
})

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>

export async function submitQuoteRequest(
  input: QuoteRequestInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = quoteRequestSchema.parse(input)
    
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
