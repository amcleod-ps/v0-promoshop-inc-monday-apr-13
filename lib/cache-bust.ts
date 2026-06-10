/**
 * Appends the `?v=<updated_at>` cache-busting parameter, joining with `&`
 * when the URL already carries a query string. Seeded Squarespace product
 * images end in `?format=NNNNw` — naively appending a second `?` corrupts
 * the existing params (and breaks outright on stricter hosts). Shared by
 * every `lib/supabase/*` getter and the client-side image resolver so the
 * busting behaviour can't drift between them.
 */
export function withCacheBust(url: string, version: string): string {
  if (!url) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}v=${encodeURIComponent(version)}`
}
