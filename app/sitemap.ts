import type { MetadataRoute } from "next"
import { getSupabaseBrands } from "@/lib/supabase/data"
import { BRANDS } from "@/lib/brands"
import { SITE_URL } from "@/lib/site-url"

// Marketing routes + the live brand catalog. /my-quote, /sign-in and
// /sign-up are deliberately excluded (noindex utility pages), and
// /admin-dashboard must never appear here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const live = await getSupabaseBrands()
  const brands = live ?? BRANDS
  const now = new Date()

  return [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/studio`, lastModified: now, priority: 0.9 },
    { url: `${SITE_URL}/brands`, lastModified: now, priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: now, priority: 0.5 },
    ...brands.map((brand) => ({
      url: `${SITE_URL}/brands/${brand.slug}`,
      lastModified: now,
      priority: 0.7,
    })),
  ]
}
