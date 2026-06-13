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
  const encoded = encodeURIComponent(version)
  // Idempotent: a URL that already carries a `v=` cache-bust param (e.g. one
  // that gets passed through the resolver twice) has that value replaced
  // rather than a second `v=` appended, which would corrupt the query string.
  // `([?&])v=` only matches a whole `v` param, never `rev=`/`?v2=`/etc.
  const existing = /([?&])v=[^&#]*/
  if (existing.test(url)) {
    return url.replace(existing, `$1v=${encoded}`)
  }
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}v=${encoded}`
}
