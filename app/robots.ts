import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site-url"

// Allow-all + sitemap reference. /admin-dashboard is deliberately NOT
// mentioned here — a Disallow line would advertise the private path; the
// route protects itself with noindex metadata and an X-Robots-Tag header.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
