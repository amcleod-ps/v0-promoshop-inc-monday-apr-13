import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client using the service-role key. Bypasses Row-Level
 * Security and has full read/write access to every table and Storage bucket.
 *
 * NEVER import this from a client component, a `"use client"` file, or
 * anything that ends up in a browser bundle. Use it only from server
 * actions and Server Components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel (Project Settings → Environment Variables).",
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
