import type { MetadataRoute } from "next"
import { getSupabaseBrands } from "@/lib/supabase/data"
import { getCollections } from "@/lib/supabase/collections"
import { BRANDS } from "@/lib/brands"
import { SITE_URL } from "@/lib/site-url"

// Marketing routes + the live brand catalog + active collections. /my-quote,
// /sign-in and /sign-up are deliberately excluded (noindex utility pages), and
// /admin-dashboard must never appear here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [live, collections] = await Promise.all([getSupabaseBrands(), getCollections()])
  const brands = live ?? BRANDS
  const now = new Date()

  return [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/studio`, lastModified: now, priority: 0.9 },
    { url: `${SITE_URL}/brands`, lastModified: now, priority: 0.8 },
    { url: `${SITE_URL}/collections`, lastModified: now, priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, priority: 0.5 },
    ...brands.map((brand) => ({
      url: `${SITE_URL}/brands/${brand.slug}`,
      lastModified: now,
      priority: 0.7,
    })),
    ...collections.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      lastModified: now,
      priority: 0.6,
    })),
  ]
}
