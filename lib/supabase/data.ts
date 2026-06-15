import { cache } from "react"
import { createClient } from "./server"
import { withCacheBust } from "@/lib/cache-bust"
import { isSafeLinkTarget } from "@/lib/url-safety"

export interface SupabaseBrand {
  id: string
  name: string
  slug: string
  logo_url: string | null
  website_url: string | null
  description: string | null
  categories: string[]
  featured: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SupabaseHeroSlide {
  id: string
  title: string
  subtitle: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  bg_color: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

function bustedUrl(url: string | null | undefined, updatedAt: string): string | null {
  if (!url) return null
  return withCacheBust(url, updatedAt)
}

async function maybeClient() {
  try {
    return await createClient()
  } catch {
    // Missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY env vars — return null
    // so the page can render its static fallback content instead of
    // throwing and 500-ing the whole route (and, via the root layout,
    // every other route including /admin-dashboard).
    return null
  }
}

/**
 * Returns the active hero slides, or `null` when Supabase is unreachable /
 * misconfigured. `null` means "fall back to the compiled-in slides"; an
 * empty array means the admin deactivated every slide on purpose and the
 * caller should render nothing rather than resurrect the static defaults.
 */
export const getHeroSlides = cache(async (): Promise<SupabaseHeroSlide[] | null> => {
  const supabase = await maybeClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data) return null

  return data.map((row) => ({
    ...row,
    image_url: bustedUrl(row.image_url, row.updated_at),
    // Re-validate the link target on read: the Supabase Table Editor bypasses
    // the dashboard's write-side validation, and the homepage renders this
    // value as an <a href>, so a stored `javascript:` URL would be clickable
    // stored XSS. Drop anything that isn't a same-site path or http(s) URL —
    // the slideshow already hides the CTA when cta_url is null.
    cta_url: isSafeLinkTarget(row.cta_url) ? row.cta_url : null,
  }))
})

/**
 * Returns the active brands, or `null` when Supabase is unreachable (use
 * the static seed). An empty array is a real "no active brands" state.
 */
export const getSupabaseBrands = cache(async (): Promise<SupabaseBrand[] | null> => {
  const supabase = await maybeClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data) return null

  return data.map((row) => ({
    ...row,
    logo_url: bustedUrl(row.logo_url, row.updated_at),
  }))
})

// Single-brand live lookup for /brands/[slug]. The two failure modes need
// different handling, so they're kept distinct:
//   * { ok: false }            — Supabase unreachable / query error. Caller
//                                may fall back to the compiled-in seed.
//   * { ok: true, brand: null } — Supabase answered and no visible brand row
//                                exists. Caller should 404, NOT resurrect a
//                                seed brand the admin may have deleted.
// Soft-deleted brands land in the second bucket: the anon-key RLS policy
// ("brands_public_read_active") hides inactive rows, so a deactivated brand
// reads back as "no row" and 404s instead of falling through to the seed.
export type SupabaseBrandLookup =
  | { ok: true; brand: SupabaseBrand | null }
  | { ok: false }

export const getSupabaseBrandBySlug = cache(async (slug: string): Promise<SupabaseBrandLookup> => {
  const supabase = await maybeClient()
  if (!supabase) return { ok: false }
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()

  if (error) return { ok: false }
  if (!data) return { ok: true, brand: null }

  return {
    ok: true,
    brand: {
      ...data,
      logo_url: bustedUrl(data.logo_url, data.updated_at),
    },
  }
})
