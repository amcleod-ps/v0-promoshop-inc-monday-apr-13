// Production URL for absolute OG/canonical/sitemap URLs. Until the custom
// domain is confirmed, NEXT_PUBLIC_SITE_URL (or Vercel's production URL)
// drives this; localhost keeps relative resolution working in dev.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
