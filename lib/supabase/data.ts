import { createClient } from "./server"

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
  return `${url}?v=${encodeURIComponent(updatedAt)}`
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

export async function getHeroSlides(): Promise<SupabaseHeroSlide[]> {
  const supabase = await maybeClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    ...row,
    image_url: bustedUrl(row.image_url, row.updated_at),
  }))
}

export async function getSupabaseBrands(): Promise<SupabaseBrand[]> {
  const supabase = await maybeClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    ...row,
    logo_url: bustedUrl(row.logo_url, row.updated_at),
  }))
}
