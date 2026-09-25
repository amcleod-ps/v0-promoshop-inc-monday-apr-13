/**
 * Plain-language summary of the two pricing release gates for the admin
 * Pricing tab. The audience is a non-technical client, so the copy never
 * names the gates themselves: it says only what customers can see and, when
 * the gates disagree, who can fix it. Pure module so the states are testable.
 */
export interface PricingStatusNotice {
  tone: "neutral" | "warning"
  heading: string
  body: string
}

export function pricingStatusNotice({
  dbFlagEnabled,
  serverFlagEnabled,
}: {
  dbFlagEnabled: boolean
  serverFlagEnabled: boolean
}): PricingStatusNotice {
  if (dbFlagEnabled && serverFlagEnabled) {
    return {
      tone: "neutral",
      heading: "Public pricing is live.",
      body: "Customers can see estimated prices on the website.",
    }
  }

  if (!dbFlagEnabled && !serverFlagEnabled) {
    return {
      tone: "neutral",
      heading: "Public pricing is off.",
      body: "Customers cannot see prices on the website. You can still prepare prices on this page.",
    }
  }

  // Either gate alone keeps pricing hidden (lib/supabase/pricing.ts fails
  // closed), so a mismatch is never "half live" — it needs a developer.
  return {
    tone: "warning",
    heading: "Public pricing is not set up correctly.",
    body: "One pricing setting is on and the other is off, so customers cannot see prices. Ask your website developer to fix this.",
  }
}
