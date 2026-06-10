// Production URL for absolute OG/canonical/sitemap URLs. Until the custom
// domain is confirmed, NEXT_PUBLIC_SITE_URL (or Vercel's production URL)
// drives this; localhost keeps relative resolution working in dev.
//
// Values are validated through `new URL()` with a fallback chain: the root
// layout feeds SITE_URL straight into `metadataBase`, so a malformed env
// value (e.g. a scheme-less "www.promoshopinc.com") must degrade gracefully
// instead of throwing at module scope and 500-ing every route.
function parseOrigin(candidate: string | undefined): string | null {
  if (!candidate) return null
  try {
    return new URL(candidate).origin
  } catch {
    console.error(`Invalid site URL ignored: ${JSON.stringify(candidate)} — expected e.g. https://www.promoshopinc.com`)
    return null
  }
}

export const SITE_URL =
  parseOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  parseOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ) ??
  "http://localhost:3000"
